package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.flywaydb.core.Flyway
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.jdbc.core.JdbcTemplate
import org.testcontainers.postgresql.PostgreSQLContainer
import workbench.sharing.adapter.security.RandomDeviceSecrets
import workbench.sharing.application.SharingService
import java.nio.file.Files
import java.sql.DriverManager
import java.sql.Timestamp
import java.time.Instant
import java.util.UUID

class SharingOnboardingUpgradeTest : StringSpec({
    "V24 preserves existing G2 credentials and pending token while adding non-secret invitation identity" {
        val db=PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
        val root=Files.createTempDirectory("sharing-v24")
        db.start()
        try {
            Flyway.configure().dataSource(db.jdbcUrl,db.username,db.password).defaultSchema("workbench_setup").target("23").load().migrate()
            val campaign=UUID.randomUUID();val player=UUID.randomUUID();val device=UUID.randomUUID()
            val secrets=RandomDeviceSecrets();val credential=secrets.generate();val invitation=secrets.generate();val now=Instant.now()
            DriverManager.getConnection(db.jdbcUrl,db.username,db.password).use { c ->
                c.prepareStatement("INSERT INTO campaigns.campaign VALUES (?, 'Existing', ?, '**/*.md', '', 0)").use { it.setObject(1,campaign);it.setString(2,root.toString());it.executeUpdate() }
                c.prepareStatement("INSERT INTO sharing.player VALUES (?,?, 'Existing player',true)").use { it.setObject(1,player);it.setObject(2,campaign);it.executeUpdate() }
                c.prepareStatement("INSERT INTO sharing.device VALUES (?,?,?,?,?,?,NULL)").use {
                    it.setObject(1,device);it.setObject(2,campaign);it.setObject(3,player);it.setString(4,secrets.hash(credential));it.setTimestamp(5,Timestamp.from(now));it.setTimestamp(6,Timestamp.from(now));it.executeUpdate()
                }
                c.prepareStatement("INSERT INTO sharing.invitation VALUES (?,?,?,?,?,NULL)").use {
                    it.setObject(1,campaign);it.setObject(2,player);it.setString(3,secrets.hash(invitation));it.setTimestamp(4,Timestamp.from(now));it.setTimestamp(5,Timestamp.from(now.plusSeconds(300)));it.executeUpdate()
                }
            }
            val context=SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0","--workbench.gateway.port=0","--spring.datasource.url=${db.jdbcUrl}","--spring.datasource.username=${db.username}","--spring.datasource.password=${db.password}")
            try {
                val service=context.getBean(SharingService::class.java)
                service.identify(campaign,credential).getOrNull()!!.device shouldBe device
                val id=context.getBean(JdbcTemplate::class.java).queryForObject("SELECT id FROM sharing.invitation WHERE campaign=?",UUID::class.java,campaign)!!
                service.invitationStatus(campaign,player,id).getOrNull()!!.state shouldBe "pending"
                service.redeem(campaign,invitation).isRight() shouldBe true
                service.invitationStatus(campaign,player,id).getOrNull()!!.state shouldBe "used"
                service.identify(campaign,credential).isRight() shouldBe true
            } finally { context.close() }
        } finally { db.stop();root.toFile().deleteRecursively() }
    }
})
