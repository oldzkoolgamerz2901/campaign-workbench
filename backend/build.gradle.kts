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
    implementation(libs.commonmark.core)
    implementation(libs.commonmark.tables)
    implementation(libs.snakeyaml.engine)
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

// Development orchestration is isolated from application classes and the production jar.
val development = sourceSets.create("development")
tasks.register<JavaExec>("dev") {
    group = "application"
    description = "Start PostgreSQL, Spring and Angular; stop owned servers when cancelled."
    dependsOn(tasks.named("bootJar"), development.classesTaskName)
    classpath = development.runtimeClasspath
    mainClass.set("workbench.dev.DevLauncher")
    javaLauncher.set(javaToolchains.launcherFor { languageVersion.set(JavaLanguageVersion.of(libs.versions.java.get())) })
    workingDir = rootDir.parentFile
    args(rootDir.parentFile.absolutePath,
        tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar").get().archiveFile.get().asFile.absolutePath,
        openapiGenerator.asPath, libs.versions.angular.asProvider().get())
}


val developmentCheck = sourceSets.create("developmentCheck") {
    compileClasspath = fileTree(gradle.gradleHomeDir!!.resolve("lib")) { include("*.jar") }
    runtimeClasspath += compileClasspath
}
tasks.register<JavaExec>("checkDevStartup") {
    group = "verification"
    description = "Exercise real startup and IntelliJ-style cancellation using isolated PostgreSQL."
    dependsOn(developmentCheck.classesTaskName)
    classpath = developmentCheck.runtimeClasspath
    mainClass.set("CheckDevStartup")
    javaLauncher.set(javaToolchains.launcherFor { languageVersion.set(JavaLanguageVersion.of(libs.versions.java.get())) })
    args(rootDir.parentFile.absolutePath, gradle.gradleHomeDir!!.absolutePath)
}
