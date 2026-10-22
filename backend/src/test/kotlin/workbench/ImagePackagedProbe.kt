package workbench

import java.nio.file.Files
import java.nio.file.Path
import workbench.platform.adapter.image.ImageIoProcessor

/** Invoked by Boot's PropertiesLauncher; application and codecs come only from the packaged jar. */
object ImagePackagedProbe {
    @JvmStatic fun main(args: Array<String>) {
        val location = ImageIoProcessor::class.java.protectionDomain.codeSource.location.toString()
        check(location.contains("BOOT-INF/classes")) { "Processor must come from bootJar: $location" }
        for (name in listOf("lossy", "lossless", "transparent")) {
            val image = Files.newInputStream(Path.of(args.single(), "$name.webp")).use { ImageIoProcessor().process(it) }
            check(image.isRight()) { "Packaged WebP decode failed: $name: $image" }
        }
        println("Packaged Java ${Runtime.version().feature()} WebP decode passed: lossy, lossless, transparent.")
    }
}
