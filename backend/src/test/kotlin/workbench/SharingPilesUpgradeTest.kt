package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.flywaydb.core.Flyway
import org.testcontainers.postgresql.PostgreSQLContainer
import java.sql.DriverManager
import java.util.UUID

class SharingPilesUpgradeTest : StringSpec({
    "V26 preserves existing active and removed cards their order and retry parameters" {
        val db=PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
        db.start()
        try {
            fun flyway(target: String)=Flyway.configure().dataSource(db.jdbcUrl,db.username,db.password).defaultSchema("workbench_setup").target(target).load()
            flyway("25").migrate()
            val campaign=UUID.randomUUID(); val first=UUID.randomUUID(); val second=UUID.randomUUID(); val op=UUID.randomUUID()
            DriverManager.getConnection(db.jdbcUrl,db.username,db.password).use { c ->
                c.createStatement().use { sql ->
                    sql.executeUpdate("INSERT INTO sharing.card_content VALUES ('$campaign','$first','{}','{}'),('$campaign','$second','{}','{}')")
                    sql.executeUpdate("INSERT INTO sharing.shared_card(campaign,id,content,mode,state,position) VALUES ('$campaign','$first','$first','HANDOUT','ACTIVE',9),('$campaign','$second','$second','INVENTORY','DISCARDED',4)")
                    sql.executeUpdate("INSERT INTO sharing.distribution VALUES ('$campaign','$op','{\"recipient\":null}','$first')")
                }
            }
            flyway("26").migrate()
            DriverManager.getConnection(db.jdbcUrl,db.username,db.password).use { c ->
                c.createStatement().use { sql ->
                    sql.executeQuery("SELECT id,state,position,pile FROM sharing.shared_card ORDER BY position").use { r ->
                        r.next() shouldBe true; r.getObject("id") shouldBe second; r.getString("state") shouldBe "DISCARDED"; r.getLong("position") shouldBe 4L; r.getObject("pile") shouldBe null
                        r.next() shouldBe true; r.getObject("id") shouldBe first; r.getLong("position") shouldBe 9L; r.getObject("pile") shouldBe null
                    }
                    sql.executeQuery("SELECT parameters::text FROM sharing.distribution WHERE operation='$op'").use { r -> r.next(); r.getString(1) shouldBe "{\"recipient\": null}" }
                    sql.executeQuery("SELECT count(*) FROM sharing.pile").use { r -> r.next(); r.getLong(1) shouldBe 0L }
                }
            }
        } finally { db.stop() }
    }
})
