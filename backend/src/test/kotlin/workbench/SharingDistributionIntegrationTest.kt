package workbench

import arrow.core.Either
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.web.server.context.WebServerApplicationContext
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import org.springframework.jdbc.core.JdbcTemplate
import org.testcontainers.postgresql.PostgreSQLContainer
import tools.jackson.databind.ObjectMapper
import workbench.campaigns.api.*
import workbench.campaigns.application.CampaignService
import workbench.gateway.application.GatewayService
import workbench.platform.api.*
import workbench.preparation.api.*
import workbench.sharing.api.*
import workbench.sharing.application.*
import workbench.sources.api.CardLayoutInput
import java.net.URI
import java.net.http.*
import java.nio.file.Files
import java.time.Instant
import java.util.UUID
import java.util.concurrent.*

class DistributionSources : PreparedCards {
    @Volatile var source: PreparedCard? = null
    override fun card(campaign: UUID, session: UUID, item: UUID): Either<Failure,PreparedCard> =
        source?.let { Either.Right(it) } ?: Either.Left(Failure.NotFound("test.source","Source removed"))
}
@TestConfiguration(proxyBeanMethods=false)
class DistributionConfiguration {
    @Bean @Primary fun distributionSources()=DistributionSources()
}
class SharingDistributionIntegrationTest : StringSpec({
    val db=PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    val root=Files.createTempDirectory("sharing-distribution")
    var context: ConfigurableApplicationContext?=null
    lateinit var campaign: UUID
    lateinit var other: UUID
    val session=UUID.randomUUID(); val item=UUID.randomUUID()
    fun start()=SpringApplicationBuilder(CampaignWorkbenchApplication::class.java,DistributionConfiguration::class.java).run(
        "--server.port=0","--workbench.gateway.port=0","--spring.datasource.url=${db.jdbcUrl}",
        "--spring.datasource.username=${db.username}","--spring.datasource.password=${db.password}")
    fun distribution()=context!!.getBean(DistributionService::class.java)
    fun sharing()=context!!.getBean(SharingService::class.java)
    fun collections()=context!!.getBean(PlayerCards::class.java)
    fun sources()=context!!.getBean(DistributionSources::class.java)
    fun jdbc()=context!!.getBean(JdbcTemplate::class.java)
    fun request(recipient: UUID?=null)=DistributeCard(UUID.randomUUID(),session,item,
        distribution().preview(campaign,PreviewSharedCard(session,item)).getOrNull()!!.fingerprint,SharingMode.INVENTORY,recipient)
    fun paired(): Pair<CampaignPlayerData,PairingResult> {
        val p=sharing().add(campaign,AddCampaignPlayer("Reader")).getOrNull()!!
        val invite=sharing().invite(campaign,p.id).getOrNull()!!
        return p to sharing().redeem(campaign,invite.token).getOrNull()!!
    }
    beforeSpec {
        db.start(); context=start()
        val campaigns=context!!.getBean(CampaignService::class.java)
        campaign=campaigns.register(RegisterCampaign("Distribution",Files.createDirectory(root.resolve("a")).toString())).getOrNull()!!.id
        other=campaigns.register(RegisterCampaign("Other",Files.createDirectory(root.resolve("b")).toString())).getOrNull()!!.id
    }
    beforeTest {
        val image=context!!.getBean(ImageProcessor::class.java).process(ImageFixtures.png(60,40).inputStream()).getOrNull()!!
        sources().source=PreparedCard(CardLayoutInput("Visible title","item","Visible summary",listOf("key"),"Visible back"),image,
            PreparedCardProvenance(campaign,session,item,null,"DM_PRIVATE_PATH",null,"DM_DOCUMENT_HASH","DM_CONTENT_HASH","source",null,null,null,null))
    }
    afterSpec { context?.close(); db.stop(); root.toFile().deleteRecursively() }

    "real Preparation contract excludes authored originals documents notes and links even from retained private provenance" {
        val sessionId=UUID.randomUUID(); val itemId=UUID.randomUUID(); val fallbackId=UUID.randomUUID()
        val origin=workbench.preparation.domain.AuthoredOrigin(UUID.randomUUID(),UUID.randomUUID(),1,UUID.randomUUID(),Instant.now().toString(),
            "PRIVATE_ORIGINAL_DOCUMENT", "hash",campaign,null,"original.md",emptyList())
        val metadata=workbench.preparation.domain.CapturedCard(1,origin.card,"Visible","npc","session","draft",listOf("tag"),"Visible summary","Visible back")
        val captured=workbench.preparation.domain.CapturedSource(1,0,workbench.preparation.domain.CapturedClassification(metadata,emptyList()),emptyList())
        val item=workbench.preparation.domain.PreparedItem(itemId,"Fallback title","PRIVATE_CURRENT_DOCUMENT",
            workbench.preparation.domain.Provenance(campaign,null,"card.md",null,"hash","hash","authored",origin),emptyMap(),"PRIVATE_NOTES",captured)
        val transaction=context!!.getBean(Transactions::class.java)
        transaction.run {
            context!!.getBean(Campaigns::class.java).configuration(campaign).map {
                context!!.getBean(workbench.preparation.application.SessionStore::class.java).put(
                    workbench.preparation.domain.Session(sessionId,campaign,0,"Test","","PRIVATE_SESSION_NOTES",listOf(item,item.copy(id=fallbackId,capturedSource=null))))
            }
        }.isRight() shouldBe true
        val prepared=context!!.getBean(workbench.preparation.application.PreparedCardService::class.java)
        val source=prepared.card(campaign,sessionId,itemId).getOrNull()!!
        source.visible.summary shouldBe "Visible summary"
        source.provenance.draft shouldBe origin.draft
        prepared.card(campaign,sessionId,fallbackId).getOrNull()!!.visible shouldBe CardLayoutInput("Fallback title","card","",emptyList(),"")
        prepared.card(campaign,sessionId,UUID.randomUUID()).isLeft() shouldBe true
        val app=DistributionService(context!!.getBean(Campaigns::class.java),prepared,context!!.getBean(SharingStore::class.java),context!!.getBean(SharedCardStore::class.java),transaction,context!!.getBean(SharingClock::class.java))
        val preview=app.preview(campaign,PreviewSharedCard(sessionId,itemId)).getOrNull()!!
        val card=app.distribute(campaign,DistributeCard(UUID.randomUUID(),sessionId,itemId,preview.fingerprint,SharingMode.HANDOUT,null)).getOrNull()!!
        val retained=jdbc().queryForObject("SELECT provenance::text FROM sharing.card_content WHERE campaign=? AND id=?",String::class.java,campaign,card.id)!!
        listOf("PRIVATE_ORIGINAL_DOCUMENT","PRIVATE_CURRENT_DOCUMENT","PRIVATE_NOTES","PRIVATE_SESSION_NOTES","original","links").forEach { retained.contains(it) shouldBe false }
    }
    "exact preview rejects changed visible content and artwork without partial distribution" {
        val req=request(); val count=jdbc().queryForObject("SELECT count(*) FROM sharing.shared_card",Long::class.java)
        sources().source=sources().source!!.copy(visible=sources().source!!.visible.copy(backText="Changed"))
        (distribution().distribute(campaign,req).swap().getOrNull() is Failure.Conflict) shouldBe true
        distribution().previewArtwork(campaign,req).isLeft() shouldBe true
        jdbc().queryForObject("SELECT count(*) FROM sharing.shared_card",Long::class.java) shouldBe count
        val fresh=request(); sources().source=sources().source!!.copy(artwork=null)
        distribution().distribute(campaign,fresh).isLeft() shouldBe true
    }
    "private provenance changes do not invalidate visible preview and never reach player payload" {
        val (p,device)=paired(); val req=request(p.id)
        sources().source=sources().source!!.copy(provenance=sources().source!!.provenance.copy(path="OTHER_PRIVATE_PATH"))
        val card=distribution().distribute(campaign,req).getOrNull()!!
        val data=collections().collections(campaign,device.credential).getOrNull()!!
        data.mine.cards.map { it.id }.contains(card.id) shouldBe true
        val json=context!!.getBean(ObjectMapper::class.java).writeValueAsString(data)
        listOf("provenance","markdown","notes","DM_","OTHER_PRIVATE_PATH","documentHash").forEach { json.contains(it) shouldBe false }
    }
    "concurrent retries create one immutable instance with one event and recover after source removal" {
        val req=request(); val pool=Executors.newFixedThreadPool(2); val go=CountDownLatch(1)
        try {
            val attempts=(1..2).map { pool.submit<SharedCardData> { go.await(); distribution().distribute(campaign,req).getOrNull()!! } }
            go.countDown(); val ids=attempts.map { it.get(10,TimeUnit.SECONDS).id }
            ids.distinct().size shouldBe 1
            jdbc().queryForObject("SELECT count(*) FROM sharing.card_event WHERE card=?",Long::class.java,ids.first()) shouldBe 1L
            sources().source=null
            distribution().distribute(campaign,req).getOrNull()!!.id shouldBe ids.first()
            distribution().artwork(campaign,ids.first()).isRight() shouldBe true
            distribution().distribute(campaign,req.copy(mode=SharingMode.HANDOUT)).isLeft() shouldBe true
        } finally { pool.shutdownNow() }
    }
    "fresh operations create distinct copies and failed insert rolls back content artwork placement event and retry record" {
        val req=request(); val first=distribution().distribute(campaign,req).getOrNull()!!
        val second=distribution().distribute(campaign,req.copy(operation=UUID.randomUUID())).getOrNull()!!
        (first.id!=second.id) shouldBe true
        val store=context!!.getBean(SharedCardStore::class.java)
        val failing=object: SharedCardStore by store {
            override fun insert(campaign:UUID,request:DistributeCard,source:PreparedCard,now:Instant):SharedCardData {
                store.insert(campaign,request,source,now); error("After all inserts")
            }
        }
        val app=DistributionService(context!!.getBean(Campaigns::class.java),sources(),context!!.getBean(SharingStore::class.java),failing,
            context!!.getBean(Transactions::class.java),context!!.getBean(SharingClock::class.java))
        val tables=listOf("card_content","card_artwork","shared_card","card_event","distribution")
        val before=tables.map { jdbc().queryForObject("SELECT count(*) FROM sharing.$it",Long::class.java) }
        val retry=req.copy(operation=UUID.randomUUID())
        shouldThrow<IllegalStateException> { app.distribute(campaign,retry) }
        tables.map { jdbc().queryForObject("SELECT count(*) FROM sharing.$it",Long::class.java) } shouldBe before
        distribution().distribute(campaign,retry).isRight() shouldBe true
    }
    "every collection artwork and layout read reauthorizes and scopes recipient and campaign" {
        val (p,device)=paired(); val (_,stranger)=paired()
        val card=distribution().distribute(campaign,request(p.id)).getOrNull()!!
        collections().artwork(campaign,device.credential,card.id).isRight() shouldBe true
        collections().layout(campaign,device.credential,card.id).isRight() shouldBe true
        collections().artwork(campaign,stranger.credential,card.id).isLeft() shouldBe true
        collections().layout(campaign,stranger.credential,card.id).isLeft() shouldBe true
        collections().collections(campaign,stranger.credential).getOrNull()!!.mine.cards.none { it.id==card.id } shouldBe true
        collections().collections(other,device.credential).isLeft() shouldBe true
        sharing().activate(campaign,p.id,false)
        collections().collections(campaign,device.credential).isLeft() shouldBe true
        collections().artwork(campaign,device.credential,card.id).isLeft() shouldBe true
        sharing().activate(campaign,p.id,true); sharing().revoke(campaign,device.identity.device)
        collections().layout(campaign,device.credential,card.id).isLeft() shouldBe true
        collections().collections(campaign,device.credential).isLeft() shouldBe true
    }
    "historical oversized sides remain complete in safe collection fields and report non-fitting layout" {
        val (_,device)=paired()
        val text="Historical complete back. ".repeat(500)
        sources().source=sources().source!!.copy(visible=sources().source!!.visible.copy(backText=text))
        val card=distribution().distribute(campaign,request()).getOrNull()!!
        collections().collections(campaign,device.credential).getOrNull()!!.group.cards.single { it.id==card.id }.visible.backText shouldBe text
        collections().layout(campaign,device.credential,card.id).getOrNull()!!.back.fits shouldBe false
    }
    "revocation waits for the authorized read transaction and the following read is denied" {
        val (_,device)=paired()
        val entered=CountDownLatch(1); val release=CountDownLatch(1)
        val store=context!!.getBean(SharedCardStore::class.java)
        val delayed=object: SharedCardStore by store {
            override fun cards(campaign:UUID,recipient:UUID?):List<SharedCardData> {
                if(recipient==null) { entered.countDown(); check(release.await(5,TimeUnit.SECONDS)) }
                return store.cards(campaign,recipient)
            }
        }
        val service=CollectionService(context!!.getBean(PlayerAccess::class.java),delayed,context!!.getBean(Transactions::class.java),context!!.getBean(workbench.sources.api.CardLayoutCalculator::class.java))
        val pool=Executors.newFixedThreadPool(2)
        try {
            val read=pool.submit<Boolean> { service.collections(campaign,device.credential).isRight() }
            entered.await(3,TimeUnit.SECONDS) shouldBe true
            val started=CountDownLatch(1)
            val revoke=pool.submit<Boolean> { started.countDown(); sharing().revoke(campaign,device.identity.device).isRight() }
            started.await(3,TimeUnit.SECONDS) shouldBe true
            shouldThrow<TimeoutException> { revoke.get(100,TimeUnit.MILLISECONDS) }
            release.countDown(); read.get(5,TimeUnit.SECONDS) shouldBe true; revoke.get(5,TimeUnit.SECONDS) shouldBe true
            service.collections(campaign,device.credential).isLeft() shouldBe true
        } finally { release.countDown(); pool.shutdownNow() }
    }
    "HTTP player routes are admitted explicitly and private distribution stays inaccessible" {
        val (_,device)=paired(); val card=distribution().distribute(campaign,request()).getOrNull()!!
        val gateway=context!!.getBean(GatewayService::class.java); gateway.select(campaign); gateway.enable()
        val port=gateway.status().port!!; val dm=(context as WebServerApplicationContext).webServer!!.port
        val client=HttpClient.newHttpClient()
        fun get(port:Int,path:String,auth:Boolean=true)=client.send(HttpRequest.newBuilder(URI("http://127.0.0.1:$port$path"))
            .header("Authorization",if(auth) "Bearer ${device.credential}" else "Bearer bad").GET().build(),HttpResponse.BodyHandlers.ofByteArray())
        listOf("/player-api/collections","/player-api/cards/${card.id}/layout","/player-api/cards/${card.id}/artwork").forEach { path ->
            get(port,path).let { it.statusCode() shouldBe 200; it.headers().firstValue("Cache-Control").orElse("") shouldBe "no-store" }
            get(port,path,false).statusCode() shouldBe 401
            get(dm,path).statusCode() shouldBe 409
        }
        get(port,"/api/campaigns/$campaign/sharing/collection").statusCode() shouldBe 404
        get(port,"/player-api/cards/${card.id}/%6cayout").statusCode() shouldBe 404
        get(port,"/player-api/cards/${card.id}/layout/extra").statusCode() shouldBe 404
        gateway.disable()
    }
    "frozen content artwork and retry result survive restart with source unavailable" {
        val req=request(); val card=distribution().distribute(campaign,req).getOrNull()!!
        val bytes=distribution().artwork(campaign,card.id).getOrNull()!!.content.sha256
        context!!.close(); context=start(); sources().source=null
        distribution().distribute(campaign,req).getOrNull() shouldBe card
        distribution().artwork(campaign,card.id).getOrNull()!!.content.sha256 shouldBe bytes
    }
})
