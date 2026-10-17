package workbench

import com.tngtech.archunit.core.importer.ClassFileImporter
import com.tngtech.archunit.core.importer.ImportOption
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses
import io.kotest.core.spec.style.StringSpec
import org.springframework.modulith.core.ApplicationModules

class ArchitectureTest : StringSpec({
    "modules expose only their API and have no cycles" {
        ApplicationModules.of(CampaignWorkbenchApplication::class.java).verify()
    }
    "domain and application dependencies point inward" {
        val classes = ClassFileImporter().withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("workbench")
        noClasses().that().resideInAPackage("..domain..")
            .should().dependOnClassesThat().resideInAnyPackage(
                "org.springframework..", "jakarta.persistence..", "java.nio.file..", "java.net..",
                "org.commonmark..",
                "..adapter..", "..application..")
            .allowEmptyShould(true).check(classes)
        noClasses().that().resideInAPackage("..application..")
            .should().dependOnClassesThat().resideInAPackage("..adapter..")
            .allowEmptyShould(true).check(classes)
    }
})
