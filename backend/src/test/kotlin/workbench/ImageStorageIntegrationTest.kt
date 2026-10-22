package workbench

import arrow.core.Either
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import org.flywaydb.core.Flyway
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.dao.InvalidDataAccessApiUsageException
import org.testcontainers.postgresql.PostgreSQLContainer
import workbench.platform.api.*
import workbench.preparation.application.PreparationImageStore
import workbench.writing.application.WritingImageOwner
import workbench.writing.application.WritingImageStore
import java.sql.DriverManager
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class ImageStorageIntegrationTest : StringSpec({
    val database = PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    var context: ConfigurableApplicationContext? = null
    val campaign = UUID.randomUUID(); val draft = UUID.randomUUID(); val session = UUID.randomUUID()
    fun start() = SpringApplicationBuilder(CampaignWorkbenchApplication::class.java).run("--server.port=0", "--spring.datasource.url=${database.jdbcUrl}", "--spring.datasource.username=${database.username}", "--spring.datasource.password=${database.password}")
    fun writing() = context!!.getBean(WritingImageStore::class.java)
    fun preparation() = context!!.getBean(PreparationImageStore::class.java)
    fun processed(w: Int = 13) = context!!.getBean(ImageProcessor::class.java).process(ImageFixtures.png(w, 7).inputStream()).getOrNull()!!
    beforeSpec {
        database.start()
        Flyway.configure().dataSource(database.jdbcUrl, database.username, database.password)
            .defaultSchema("workbench_setup").target("12").load().migrate()
        DriverManager.getConnection(database.jdbcUrl, database.username, database.password).use { c ->
            c.prepareStatement("INSERT INTO campaigns.campaign VALUES (?, 'Before images', '/isolated-image-upgrade-fixture', '**/*.md', '', 0)").use {
                it.setObject(1, campaign); it.executeUpdate()
            }
            c.prepareStatement("INSERT INTO writing.draft(id,campaign,card,revision,title,type,status,tags,summary,body,path) VALUES (?,?,?,0,'Existing','npc','draft','[]','','Exact old body','old.md')").use {
                it.setObject(1, draft); it.setObject(2, campaign); it.setObject(3, UUID.randomUUID()); it.executeUpdate()
            }
            c.prepareStatement("INSERT INTO preparation.session(id,campaign,revision,title,objective,notes,card_table) VALUES (?,?,0,'Existing session','','Exact old notes',NULL)").use {
                it.setObject(1, session); it.setObject(2, campaign); it.executeUpdate()
            }
        }
        context = start()
    }
    afterSpec { context?.close(); database.stop() }
    "V12 upgrade preserves existing records and adds empty independent image stores" {
        val jdbc = context!!.getBean(JdbcTemplate::class.java)
        jdbc.queryForObject("SELECT body FROM writing.draft WHERE id=?", String::class.java, draft) shouldBe "Exact old body"
        jdbc.queryForObject("SELECT notes FROM preparation.session WHERE id=?", String::class.java, session) shouldBe "Exact old notes"
        listOf("writing", "preparation").forEach { module ->
            jdbc.queryForObject("SELECT count(*) FROM $module.image_original", Long::class.java) shouldBe 0L
            jdbc.queryForObject("SELECT count(*) FROM $module.image_derivative", Long::class.java) shouldBe 0L
        }
    }
    "scope and module isolation, deduplication and independent derivative policies survive restart" {
        val image = processed(); val hash = image.metadata.hash
        val owner = WritingImageOwner.Campaign(campaign)
        writing().put(owner, image); writing().put(owner, image)
        writing().metadata(owner, hash) shouldBe image.metadata
        writing().metadata(WritingImageOwner.Campaign(UUID.randomUUID()), hash) shouldBe null
        writing().original(WritingImageOwner.Recovery(campaign), hash) shouldBe null
        writing().derivative(WritingImageOwner.Recovery(campaign), hash, 1, ImageVariant.DISPLAY) shouldBe null
        preparation().metadata(campaign, hash) shouldBe null
        preparation().put(campaign, image)
        preparation().original(UUID.randomUUID(), hash) shouldBe null
        writing().put(WritingImageOwner.Recovery(campaign), image)
        val policy2 = image.copy(derivatives = image.derivatives.map { it.copy(policy = 2) })
        writing().put(owner, policy2); preparation().put(campaign, policy2)
        listOf("writing", "preparation").forEach { module ->
            val jdbc = context!!.getBean(JdbcTemplate::class.java)
            jdbc.queryForObject("SELECT count(*) FROM $module.image_original WHERE owner_kind='campaign' AND owner_id=?", Long::class.java, campaign) shouldBe 1L
            jdbc.queryForObject("SELECT count(*) FROM $module.image_derivative WHERE owner_kind='campaign' AND owner_id=?", Long::class.java, campaign) shouldBe 4L
        }
        context!!.close(); context = start()
        writing().original(owner, hash)!!.copy().contentEquals(image.original.copy()) shouldBe true
        preparation().metadata(campaign, hash) shouldBe image.metadata
        preparation().original(campaign, hash)!!.copy().contentEquals(image.original.copy()) shouldBe true
        for (policy in 1..2) for (variant in ImageVariant.entries) {
            val expected = image.derivatives.single { it.variant == variant }
            writing().derivative(owner, hash, policy, variant)!!.content.copy().contentEquals(expected.content.copy()) shouldBe true
            preparation().derivative(campaign, hash, policy, variant)!!.content.copy().contentEquals(expected.content.copy()) shouldBe true
        }
        val returned = writing().original(owner, hash)!!.copy(); returned[0] = 0
        writing().original(owner, hash)!!.copy()[0] shouldBe (-119).toByte()
    }
    "Either.Left rolls back both originals and derivatives across both module stores" {
        val image = processed(14); val owner = WritingImageOwner.Campaign(campaign)
        context!!.getBean(Transactions::class.java).run<Unit> {
            writing().put(owner, image); preparation().put(campaign, image)
            Either.Left(Failure.Invalid("image.test-rollback", "rollback"))
        }.isLeft() shouldBe true
        writing().metadata(owner, image.metadata.hash) shouldBe null
        writing().derivative(owner, image.metadata.hash, 1, ImageVariant.DISPLAY) shouldBe null
        preparation().original(campaign, image.metadata.hash) shouldBe null
        preparation().derivative(campaign, image.metadata.hash, 1, ImageVariant.THUMBNAIL) shouldBe null
    }
    "conflicting immutable metadata or variants fail without partial writes" {
        val image = processed(15); val owner = WritingImageOwner.Campaign(campaign)
        writing().put(owner, image); preparation().put(campaign, image)
        val changed = image.copy(metadata = image.metadata.copy(width = 16))
        shouldThrow<InvalidDataAccessApiUsageException> { writing().put(owner, changed) }
        shouldThrow<InvalidDataAccessApiUsageException> { preparation().put(campaign, changed) }
        val variants = image.copy(derivatives = listOf(image.derivatives.first().copy(policy = 3), image.derivatives.last().copy(width = 1)))
        shouldThrow<InvalidDataAccessApiUsageException> { writing().put(owner, variants) }
        shouldThrow<InvalidDataAccessApiUsageException> { preparation().put(campaign, variants) }
        writing().derivative(owner, image.metadata.hash, 3, ImageVariant.DISPLAY) shouldBe null
        preparation().derivative(campaign, image.metadata.hash, 3, ImageVariant.DISPLAY) shouldBe null
        writing().metadata(owner, image.metadata.hash) shouldBe image.metadata
    }
    "concurrent same-scope inserts deduplicate in each module without overwriting variants" {
        val image = processed(16); val hash = image.metadata.hash
        val owner = WritingImageOwner.Campaign(campaign)
        val pool = Executors.newFixedThreadPool(2)
        try {
            for (module in listOf("writing", "preparation")) {
                val go = CountDownLatch(1)
                val futures = (1..2).map { pool.submit { check(go.await(10, TimeUnit.SECONDS)); if (module == "writing") writing().put(owner, image) else preparation().put(campaign, image) } }
                go.countDown(); futures.forEach { it.get(15, TimeUnit.SECONDS) }
                context!!.getBean(JdbcTemplate::class.java).queryForObject("SELECT count(*) FROM $module.image_original WHERE hash=?", Long::class.java, hash) shouldBe 1L
                context!!.getBean(JdbcTemplate::class.java).queryForObject("SELECT count(*) FROM $module.image_derivative WHERE hash=?", Long::class.java, hash) shouldBe 2L
            }
        } finally { pool.shutdownNow() }
    }
})
