package workbench

import arrow.core.Either
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.flywaydb.core.Flyway
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
import workbench.sharing.api.*
import workbench.sharing.application.*
import workbench.sharing.domain.PairedDevice
import java.net.URI
import java.net.http.*
import java.nio.file.Files
import java.sql.DriverManager
import java.time.*
import java.util.UUID
import java.util.concurrent.*

class PairingTestClock : SharingClock {
    @Volatile var instant: Instant = Instant.parse("2026-01-01T12:00:00Z")
    @Volatile var beforeNow: (() -> Unit)? = null
    override fun now(): Instant { beforeNow?.invoke(); return instant }
}
@TestConfiguration(proxyBeanMethods = false)
class PairingTestConfiguration {
    @Bean @Primary fun pairingTestClock() = PairingTestClock()
}
class SharingPairingIntegrationTest : StringSpec({
    val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    val root = Files.createTempDirectory("sharing-pairing")
    val legacy = UUID.randomUUID()
    var context: ConfigurableApplicationContext? = null
    lateinit var a: UUID
    lateinit var b: UUID
    fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java, PairingTestConfiguration::class.java).run(
        "--server.port=0", "--workbench.gateway.port=0", "--spring.datasource.url=${database.jdbcUrl}",
        "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
    fun service() = context!!.getBean(SharingService::class.java)
    fun gateway() = context!!.getBean(GatewayService::class.java)
    fun jdbc() = context!!.getBean(JdbcTemplate::class.java)
    fun clock() = context!!.getBean(PairingTestClock::class.java)
    fun player(campaign: UUID = a) = service().add(campaign, AddCampaignPlayer("Mira")).getOrNull()!!
    fun invitation(player: UUID, campaign: UUID = a) = service().invite(campaign, player).getOrNull()!!
    fun pair(player: UUID, campaign: UUID = a) = service().redeem(campaign, invitation(player,campaign).token).getOrNull()!!
    val client = HttpClient.newHttpClient()
    fun http(port: Int, path: String, method: String = "GET", body: String = "", auth: String? = null): HttpResponse<String> {
        val request=HttpRequest.newBuilder(URI("http://127.0.0.1:$port$path")).timeout(Duration.ofSeconds(10))
            .header("Content-Type","application/json").method(method,HttpRequest.BodyPublishers.ofString(body))
        if(auth!=null) request.header("Authorization",auth)
        return client.send(request.build(),HttpResponse.BodyHandlers.ofString())
    }
    fun dm() = (context as WebServerApplicationContext).webServer!!.port
    beforeSpec {
        database.start()
        Flyway.configure().dataSource(database.jdbcUrl,database.username,database.password).defaultSchema("workbench_setup").target("22").load().migrate()
        DriverManager.getConnection(database.jdbcUrl,database.username,database.password).use { connection ->
            connection.prepareStatement("INSERT INTO campaigns.campaign VALUES (?, 'Existing campaign', ?, '**/*.md', '', 0)").use {
                it.setObject(1,legacy); it.setString(2,Files.createDirectory(root.resolve("legacy")).toString()); it.executeUpdate()
            }
        }
        context=start()
        val campaigns=context!!.getBean(CampaignService::class.java)
        a=campaigns.register(RegisterCampaign("A",Files.createDirectory(root.resolve("a")).toString())).getOrNull()!!.id
        b=campaigns.register(RegisterCampaign("B",Files.createDirectory(root.resolve("b")).toString())).getOrNull()!!.id
    }
    afterSpec { context?.close(); database.stop(); root.toFile().deleteRecursively() }
    "V23 upgrades existing installation without changing campaign state" {
        context!!.getBean(Campaigns::class.java).configuration(legacy).getOrNull()!!.name shouldBe "Existing campaign"
        service().players(legacy).getOrNull()!!.players.size shouldBe 0
        jdbc().queryForObject("SELECT count(*) FROM sharing.device",Long::class.java) shouldBe 0L
    }
    "roster validation and campaign scoping preserve inactive player records" {
        service().add(a,AddCampaignPlayer(" ")).isLeft() shouldBe true
        service().add(a,AddCampaignPlayer("x".repeat(201))).isLeft() shouldBe true
        val p=player()
        service().players(b).getOrNull()!!.players.none { it.id==p.id } shouldBe true
        service().activate(b,p.id,false).isLeft() shouldBe true
        service().invite(b,p.id).isLeft() shouldBe true
        service().activate(a,p.id,false).getOrNull()!!.active shouldBe false
        service().invite(a,p.id).isLeft() shouldBe true
        service().activate(a,p.id,true).getOrNull()!!.active shouldBe true
    }
    "single use pairing stores hashes only and returns a campaign-bound identity" {
        val p=player(); val invite=invitation(p.id)
        val result=service().redeem(a,invite.token).getOrNull()!!
        result.identity.player shouldBe p.id
        result.identity.campaign shouldBe a
        result.credential.length shouldBe 43
        service().identify(a,result.credential).getOrNull() shouldBe result.identity
        service().redeem(a,invite.token).isLeft() shouldBe true
        service().identify(b,result.credential).isLeft() shouldBe true
        val secrets=context!!.getBean(DeviceSecrets::class.java)
        jdbc().queryForObject("SELECT token_hash FROM sharing.invitation WHERE campaign=? AND player=?",String::class.java,a,p.id) shouldBe secrets.hash(invite.token)
        jdbc().queryForObject("SELECT credential_hash FROM sharing.device WHERE id=?",String::class.java,result.identity.device) shouldBe secrets.hash(result.credential)
        val management=context!!.getBean(ObjectMapper::class.java).writeValueAsString(service().devices(a,p.id).getOrNull())
        management.contains(result.credential) shouldBe false
        management.contains(secrets.hash(result.credential)!!) shouldBe false
    }
    "invitation expiry is checked at redemption and equality with expiry is expired" {
        val p=player(); val invite=invitation(p.id)
        clock().instant=Instant.parse(invite.expiresAt)
        service().redeem(a,invite.token).isLeft() shouldBe true
        service().devices(a,p.id).getOrNull()!!.devices.size shouldBe 0
        val fresh=invitation(p.id)
        clock().instant=Instant.parse(fresh.expiresAt).minusMillis(1)
        service().redeem(a,fresh.token).isRight() shouldBe true
    }
    "wrong campaign cannot consume invitation and invitation is not a device credential" {
        val p=player(); val invite=invitation(p.id)
        service().redeem(b,invite.token).isLeft() shouldBe true
        service().identify(a,invite.token).isLeft() shouldBe true
        val device=service().redeem(a,invite.token).getOrNull()!!
        service().redeem(a,device.credential).isLeft() shouldBe true
        listOf(null,"","x","A".repeat(10000),"!".repeat(43)).forEach { service().identify(a,it).isLeft() shouldBe true }
    }
    "concurrent redemption creates exactly one device and one successful response" {
        val p=player(); val token=invitation(p.id).token
        val pool=Executors.newFixedThreadPool(2); val go=CountDownLatch(1)
        try {
            val attempts=(1..2).map { pool.submit<Either<Failure,PairingResult>> { go.await(); service().redeem(a,token) } }
            go.countDown(); val results=attempts.map { it.get(5,TimeUnit.SECONDS) }
            results.count { it.isRight() } shouldBe 1
            results.count { it.isLeft() } shouldBe 1
            service().devices(a,p.id).getOrNull()!!.devices.size shouldBe 1
        } finally { pool.shutdownNow() }
    }
    "device write failure rolls back both invitation consumption and inserted device" {
        val p=player(); val invite=invitation(p.id)
        val store=context!!.getBean(SharingStore::class.java)
        val failing=object : SharingStore by store {
            override fun put(device: PairedDevice) { store.put(device); error("Simulated post-insert failure") }
        }
        val app=SharingService(context!!.getBean(Campaigns::class.java),failing,context!!.getBean(Transactions::class.java),clock(),context!!.getBean(DeviceSecrets::class.java),Duration.ofMinutes(5))
        shouldThrow<IllegalStateException> { app.redeem(a,invite.token) }
        service().devices(a,p.id).getOrNull()!!.devices.size shouldBe 0
        service().redeem(a,invite.token).isRight() shouldBe true
    }
    "deactivation blocks every device but reactivation preserves valid credentials; revocation is permanent and scoped" {
        val p=player(); val one=pair(p.id); val two=pair(p.id)
        service().activate(a,p.id,false)
        (service().identify(a,one.credential).swap().getOrNull() is Failure.Forbidden) shouldBe true
        service().identify(a,two.credential).isLeft() shouldBe true
        service().devices(a,p.id).getOrNull()!!.devices.size shouldBe 2
        service().activate(a,p.id,true)
        service().identify(a,one.credential).isRight() shouldBe true
        service().revoke(b,one.identity.device).isLeft() shouldBe true
        service().revoke(a,one.identity.device).isRight() shouldBe true
        service().revoke(a,one.identity.device).isRight() shouldBe true
        service().identify(a,one.credential).isLeft() shouldBe true
        service().identify(a,two.credential).isRight() shouldBe true
        service().activate(a,p.id,false); service().activate(a,p.id,true)
        service().identify(a,one.credential).isLeft() shouldBe true
    }
    "HTTP pairing and identity derive campaign from admission and never trust request IDs" {
        val p=player(); val invite=invitation(p.id)
        gateway().select(a); gateway().enable().isRight() shouldBe true
        val port=gateway().status().port!!
        val mapper=context!!.getBean(ObjectMapper::class.java)
        val paired=http(port,"/player-api/pair","POST",mapper.writeValueAsString(RedeemPairing(invite.token)))
        paired.statusCode() shouldBe 200
        paired.headers().firstValue("Cache-Control").orElse("") shouldBe "no-store"
        val result=mapper.readValue(paired.body(),PairingResult::class.java)
        http(port,"/player-api/me").statusCode() shouldBe 401
        http(port,"/player-api/me?campaign=$b&player=${UUID.randomUUID()}",auth="Bearer ${result.credential}").let {
            it.statusCode() shouldBe 200
            mapper.readValue(it.body(),PlayerIdentity::class.java).campaign shouldBe a
            it.headers().firstValue("Cache-Control").orElse("") shouldBe "no-store"
        }
        listOf("Basic ${result.credential}","Bearer bad","Bearer ${result.credential},other").forEach {
            http(port,"/player-api/me",auth=it).statusCode() shouldBe 401
        }
        http(port,"/player-api/me").headers().firstValue("WWW-Authenticate").orElse("") shouldBe "Bearer"
        http(dm(),"/player-api/pair","POST",mapper.writeValueAsString(RedeemPairing(invitation(p.id).token))).statusCode() shouldBe 409
        http(port,"/api/campaigns/$a/sharing/players").statusCode() shouldBe 404
        http(port,"/player-api/pair","GET").statusCode() shouldBe 404
        gateway().select(b).isRight() shouldBe true; gateway().enable().isRight() shouldBe true
        http(gateway().status().port!!,"/player-api/me",auth="Bearer ${result.credential}").statusCode() shouldBe 401
        gateway().select(a); gateway().enable()
        http(gateway().status().port!!,"/player-api/me",auth="Bearer ${result.credential}").statusCode() shouldBe 200
    }
    "private management HTTP exposes no hashes and LAN cannot issue or revoke pairings" {
        val response=http(dm(),"/api/campaigns/$a/sharing/players","POST","{\"displayName\":\"HTTP player\"}")
        response.statusCode() shouldBe 200
        val mapper=context!!.getBean(ObjectMapper::class.java)
        val p=mapper.readValue(response.body(),CampaignPlayerData::class.java)
        val invite=http(dm(),"/api/campaigns/$a/sharing/players/${p.id}/pairing","POST")
        invite.statusCode() shouldBe 200
        invite.headers().firstValue("Cache-Control").orElse("") shouldBe "no-store"
        val issued=mapper.readValue(invite.body(),PairingInvitationData::class.java)
        val device=service().redeem(a,issued.token).getOrNull()!!
        http(dm(),"/api/campaigns/$a/sharing/players/${p.id}/active","PUT","{\"active\":false}").statusCode() shouldBe 200
        http(gateway().status().port!!,"/player-api/me",auth="Bearer ${device.credential}").statusCode() shouldBe 403
        http(dm(),"/api/campaigns/$a/sharing/players/${p.id}/active","PUT","{\"active\":true}").statusCode() shouldBe 200
        http(gateway().status().port!!,"/api/campaigns/$a/sharing/devices/${device.identity.device}/revoke","POST").statusCode() shouldBe 404
        http(dm(),"/api/campaigns/$a/sharing/devices/${device.identity.device}/revoke","POST").statusCode() shouldBe 200
        http(gateway().status().port!!,"/player-api/me",auth="Bearer ${device.credential}").statusCode() shouldBe 401
        val list=http(dm(),"/api/campaigns/$a/sharing/players/${p.id}/devices")
        list.statusCode() shouldBe 200
        list.body().contains("credential") shouldBe false
        list.body().contains(device.credential) shouldBe false
    }
    "campaign switch drains a player identity transaction before changing the selected campaign" {
        val p=player(); val device=pair(p.id)
        gateway().select(a); gateway().enable()
        val port=gateway().status().port!!
        val entered=CountDownLatch(1); val release=CountDownLatch(1)
        clock().beforeNow={ entered.countDown(); check(release.await(5,TimeUnit.SECONDS)) }
        val pool=Executors.newFixedThreadPool(2)
        try {
            val identity=pool.submit<HttpResponse<String>> { http(port,"/player-api/me",auth="Bearer ${device.credential}") }
            entered.await(3,TimeUnit.SECONDS) shouldBe true
            val select=pool.submit<HttpResponse<String>> { http(dm(),"/api/campaigns/$b/selection","PUT") }
            val deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(2)
            while(gateway().status().enabled && System.nanoTime()<deadline) Thread.yield()
            gateway().status().enabled shouldBe false
            select.isDone shouldBe false
            context!!.getBean(CampaignService::class.java).selected().getOrNull() shouldBe a
            release.countDown()
            identity.get(3,TimeUnit.SECONDS).statusCode() shouldBe 200
            select.get(3,TimeUnit.SECONDS).statusCode() shouldBe 200
            context!!.getBean(CampaignService::class.java).selected().getOrNull() shouldBe b
            gateway().status().enabled shouldBe false
        } finally { release.countDown(); clock().beforeNow=null; pool.shutdownNow() }
    }
    "devices persist across backend restart while gateway returns to disabled" {
        val p=player(); val device=pair(p.id); val revoked=pair(p.id)
        service().revoke(a,revoked.identity.device)
        context!!.close(); context=start()
        gateway().status().enabled shouldBe false
        gateway().select(a); gateway().enable().isRight() shouldBe true
        service().identify(a,device.credential).getOrNull()!!.player shouldBe p.id
        service().identify(a,revoked.credential).isLeft() shouldBe true
        service().identify(b,device.credential).isLeft() shouldBe true
        gateway().disable(); gateway().enable().isRight() shouldBe true
        http(gateway().status().port!!,"/player-api/me",auth="Bearer ${device.credential}").statusCode() shouldBe 200
    }
})
