package workbench

import arrow.core.Either
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import workbench.campaigns.api.*
import workbench.gateway.application.*
import workbench.platform.api.Failure
import java.util.UUID
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicInteger

private class GatewaySelectionFixture : CampaignSelection {
    val a = UUID.randomUUID(); val b = UUID.randomUUID()
    @Volatile var current: UUID? = a
    val writes = AtomicInteger()
    override fun selected(): Either<Failure, UUID?> = Either.Right(current)
    override fun select(id: UUID): Either<Failure, Campaign> {
        writes.incrementAndGet()
        if (id !in listOf(a,b)) return Either.Left(Failure.NotFound("campaign.not-found", "Missing"))
        current = id
        return Either.Right(Campaign(id,"Test","/unused",emptyList(),emptyList(),0))
    }
}
private class GatewayListenerFixture : GatewayListener {
    var opens = 0; var closes = 0; var failOpen = false; var failClose = false
    override fun open(): Either<Failure, Int> {
        opens++
        return if(failOpen) Either.Left(Failure.Conflict("test.bind","occupied")) else Either.Right(8081)
    }
    override fun close(): Either<Failure, Unit> {
        closes++
        return if(failClose) Either.Left(Failure.Conflict("test.close","cleanup failed")) else Either.Right(Unit)
    }
}
private fun waitClosed(gateway: GatewayService) {
    val deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(2)
    while(gateway.status().enabled && System.nanoTime()<deadline) Thread.yield()
    gateway.status().enabled shouldBe false
}
class GatewayServiceTest : StringSpec({
    "disabled startup, no campaign, idempotent enable and immutable admission identity" {
        val s=GatewaySelectionFixture(); val l=GatewayListenerFixture(); val g=GatewayService(s,l,1000)
        g.status().enabled shouldBe false; g.admit() shouldBe null
        s.current=null; g.enable().isLeft() shouldBe true; l.opens shouldBe 0
        s.current=s.a; g.enable().isRight() shouldBe true; g.enable().isRight() shouldBe true; l.opens shouldBe 1
        val first=g.admit()!!; val second=g.admit()!!
        first.campaign shouldBe s.a; first.activation shouldBe second.activation
        first.close(); first.close(); second.close(); g.status().activeRequests shouldBe 0
        g.disable().isRight() shouldBe true; g.enable().isRight() shouldBe true
        g.admit()!!.use { (it.activation!=first.activation) shouldBe true }
    }
    "selection drains before selection transaction, closes admission and preserves original operation campaign" {
        val s=GatewaySelectionFixture(); val g=GatewayService(s,GatewayListenerFixture(),5000)
        g.enable(); val operation=g.admit()!!; val pool=Executors.newSingleThreadExecutor()
        try {
            val change=pool.submit<Any> { g.select(s.b) }
            waitClosed(g); g.admit() shouldBe null; s.writes.get() shouldBe 0; change.isDone shouldBe false
            operation.campaign shouldBe s.a; operation.close()
            (change.get(3,TimeUnit.SECONDS) as Either<*,*>).isRight() shouldBe true
            s.current shouldBe s.b; g.status().enabled shouldBe false
        } finally { operation.close(); pool.shutdownNow() }
    }
    "timeout leaves selection unchanged, closes listener and blocks reenable until old operations finish" {
        val s=GatewaySelectionFixture(); val l=GatewayListenerFixture(); val g=GatewayService(s,l,30)
        g.enable(); val op=g.admit()!!
        g.select(s.b).isLeft() shouldBe true; s.current shouldBe s.a; s.writes.get() shouldBe 0
        l.closes shouldBe 1; g.status().enabled shouldBe false; g.enable().isLeft() shouldBe true
        op.campaign shouldBe s.a; op.close()
        g.select(s.b).isRight() shouldBe true; g.enable().isRight() shouldBe true
        g.admit()!!.use { it.campaign shouldBe s.b }
    }
    "concurrent enable cannot reopen admission while disable drains" {
        val s=GatewaySelectionFixture(); val l=GatewayListenerFixture(); val g=GatewayService(s,l,5000)
        g.enable(); val op=g.admit()!!; val pool=Executors.newFixedThreadPool(2)
        try {
            val disable=pool.submit<Any> { g.disable() }; waitClosed(g)
            val started=CountDownLatch(1)
            val enable=pool.submit<Any> { started.countDown(); g.enable() }
            started.await(2,TimeUnit.SECONDS) shouldBe true
            enable.isDone shouldBe false; g.admit() shouldBe null; op.close()
            (disable.get(3,TimeUnit.SECONDS) as Either<*,*>).isRight() shouldBe true
            (enable.get(3,TimeUnit.SECONDS) as Either<*,*>).isRight() shouldBe true
            l.opens shouldBe 2
        } finally { op.close(); pool.shutdownNow() }
    }
    "bind and cleanup failures close admission and prevent selection; invalid target leaves selection unchanged" {
        val s=GatewaySelectionFixture(); val l=GatewayListenerFixture(); val g=GatewayService(s,l,1000)
        l.failOpen=true; g.enable().isLeft() shouldBe true; g.status().enabled shouldBe false
        l.failOpen=false; g.enable().isRight() shouldBe true; l.failClose=true
        g.select(s.b).isLeft() shouldBe true; s.current shouldBe s.a; g.admit() shouldBe null
        l.failClose=false; g.disable().isRight() shouldBe true
        g.select(UUID.randomUUID()).isLeft() shouldBe true; s.current shouldBe s.a
    }
    "same campaign preserves activation; simultaneous enables bind once and selections serialize" {
        val s=GatewaySelectionFixture(); val l=GatewayListenerFixture(); val g=GatewayService(s,l,1000)
        val pool=Executors.newFixedThreadPool(4)
        try {
            val go=CountDownLatch(1)
            val enables=(1..4).map { pool.submit<Any> { go.await(); g.enable() } }; go.countDown()
            enables.forEach { (it.get(3,TimeUnit.SECONDS) as Either<*,*>).isRight() shouldBe true }; l.opens shouldBe 1
            g.select(s.a).isRight() shouldBe true; g.status().enabled shouldBe true; l.closes shouldBe 0
            listOf(s.b,s.a).map { id -> pool.submit<Any> { g.select(id) } }.forEach {
                (it.get(3,TimeUnit.SECONDS) as Either<*,*>).isRight() shouldBe true
            }
            s.writes.get() shouldBe 3; g.status().enabled shouldBe false
        } finally { pool.shutdownNow() }
    }
})
