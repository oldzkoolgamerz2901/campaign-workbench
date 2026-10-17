pluginManagement { repositories { gradlePluginPortal(); mavenCentral() } }
dependencyResolutionManagement {
    versionCatalogs { create("libs") { from(files("../docs/versions.toml")) } }
}
rootProject.name = "campaign-workbench"
