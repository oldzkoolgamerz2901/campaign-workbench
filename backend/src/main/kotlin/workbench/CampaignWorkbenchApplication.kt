package workbench

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class CampaignWorkbenchApplication

fun main(args: Array<String>) {
	runApplication<CampaignWorkbenchApplication>(*args)
}
