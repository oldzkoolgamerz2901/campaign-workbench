plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.spring.boot)
    id("io.spring.dependency-management") version "1.1.7"
}
group = "workbench"
version = "0.0.1-SNAPSHOT"
repositories { mavenCentral() }
java { toolchain { languageVersion = JavaLanguageVersion.of(libs.versions.java.get()) } }
extra["kotlin.version"] = libs.versions.kotlin.get()
extra["flyway.version"] = libs.versions.flyway.get()
dependencyManagement {
    imports { mavenBom("org.springframework.modulith:spring-modulith-bom:${libs.versions.spring.modulith.get()}") }
}
val openapiGenerator = configurations.create("openapiGenerator")
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    implementation("org.springframework.modulith:spring-modulith-starter-core")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation("org.flywaydb:flyway-database-postgresql")
    implementation(libs.arrow.core)
    implementation(libs.springdoc)
    runtimeOnly("org.postgresql:postgresql")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.modulith:spring-modulith-starter-test")
    testImplementation(libs.kotest.runner)
    testImplementation(libs.kotest.assertions)
    testImplementation(libs.archunit)
    testImplementation("org.testcontainers:testcontainers-postgresql:${libs.versions.testcontainers.get()}")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    openapiGenerator(libs.openapi.generator)
}
kotlin { compilerOptions { freeCompilerArgs.addAll("-Xjsr305=strict") } }
allOpen {
    annotation("jakarta.persistence.Entity")
    annotation("jakarta.persistence.MappedSuperclass")
    annotation("jakarta.persistence.Embeddable")
}
tasks.withType<Test> {
    useJUnitPlatform()
    systemProperty("workbench.postgres.version", libs.versions.postgresql.get())
    testLogging { events("passed", "skipped", "failed") }
}
tasks.register<JavaExec>("generateFrontendClient") {
    description = "Generate Angular API client from a running backend's OpenAPI contract."
    classpath = openapiGenerator
    mainClass.set("org.openapitools.codegen.OpenAPIGenerator")
    args("generate", "-g", "typescript-angular", "-i",
        providers.gradleProperty("openapiInput").getOrElse("http://127.0.0.1:8080/v3/api-docs"),
        "-o", "../frontend/src/api/generated", "--additional-properties",
        "ngVersion=${libs.versions.angular.asProvider().get()},providedInRoot=true,hideGenerationTimestamp=true")
}
