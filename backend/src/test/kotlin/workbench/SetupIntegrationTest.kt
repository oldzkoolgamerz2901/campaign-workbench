package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import jakarta.persistence.Entity
import jakarta.persistence.Id
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.boot.web.server.context.WebServerApplicationContext
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.jdbc.core.JdbcTemplate
import org.testcontainers.postgresql.PostgreSQLContainer
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse

// Test-only mapping validates JPA against the operational Flyway table.
@Entity
@jakarta.persistence.Table(name = "installation", schema = "workbench_setup")
class InstallationProbe(@Id var id: Int = 1)

class SetupIntegrationTest : StringSpec({
    val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    var appContext: ConfigurableApplicationContext? = null
    beforeSpec {
        database.start()
        appContext = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java)
            .properties(mapOf("server.port" to "0",
                "spring.datasource.url" to database.jdbcUrl,
                "spring.datasource.username" to database.username,
                "spring.datasource.password" to database.password))
            .run("--spring.datasource.url=${database.jdbcUrl}",
                "--spring.datasource.username=${database.username}",
                "--spring.datasource.password=${database.password}")
    }
    afterSpec {
        appContext?.close()
        database.stop()
    }
    "migrations, JPA startup and OpenAPI work with PostgreSQL" {
        val context = requireNotNull(appContext)
        context.getBean(JdbcTemplate::class.java)
            .queryForObject("SELECT count(*) FROM workbench_setup.installation", Int::class.java) shouldBe 1
        val port = (context as WebServerApplicationContext).webServer!!.port
        fun get(path: String) = HttpClient.newHttpClient().send(
            HttpRequest.newBuilder(URI("http://127.0.0.1:$port$path")).GET().build(),
            HttpResponse.BodyHandlers.ofString())
        get("/api/status").let { it.statusCode() shouldBe 200; it.body() shouldContain "ready" }
        get("/v3/api-docs").let { it.statusCode() shouldBe 200; it.body() shouldContain "getStatus" }
    }
})
