package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.flywaydb.core.Flyway
import org.testcontainers.postgresql.PostgreSQLContainer
import java.sql.DriverManager
import java.util.UUID

class SharingDisclosureUpgradeTest : StringSpec({
    "CD3 V28 preserves historical readable instances and makes predecessor retry permissions explicit" {
        val db = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
        db.start()
        try {
            fun migrate(target: String) = Flyway.configure().dataSource(db.jdbcUrl, db.username, db.password)
                .defaultSchema("workbench_setup").target(target).load().migrate()
            migrate("27")
            val campaign = UUID.randomUUID(); val card = UUID.randomUUID(); val operation = UUID.randomUUID()
            DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { connection ->
                connection.createStatement().use { sql ->
                    sql.executeUpdate("INSERT INTO sharing.card_content VALUES ('$campaign','$card','{\"backText\":\"Frozen back\"}','{}')")
                    sql.executeUpdate("INSERT INTO sharing.shared_card(campaign,id,content,mode,position) VALUES ('$campaign','$card','$card','HANDOUT',7)")
                    sql.executeUpdate("INSERT INTO sharing.distribution VALUES ('$campaign','$operation','{\"recipient\":null}','$card')")
                }
            }
            migrate("28")
            DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { connection ->
                connection.createStatement().use { sql ->
                    sql.executeQuery("SELECT back_revealed,position,visible->>'backText' FROM sharing.shared_card s JOIN sharing.card_content c ON c.campaign=s.campaign AND c.id=s.content").use { rows ->
                        rows.next() shouldBe true
                        rows.getBoolean(1) shouldBe true; rows.getLong(2) shouldBe 7L; rows.getString(3) shouldBe "Frozen back"
                    }
                    sql.executeQuery("SELECT parameters->>'revealBack',parameters->>'recipient' FROM sharing.distribution").use { rows ->
                        rows.next() shouldBe true; rows.getString(1) shouldBe "true"; rows.getString(2) shouldBe null
                    }
                }
            }
        } finally { db.stop() }
    }
})
