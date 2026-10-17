package workbench.campaigns.adapter.filesystem

import arrow.core.Either
import org.springframework.stereotype.Component
import workbench.campaigns.application.DirectoryAccess
import workbench.platform.api.Failure
import java.nio.file.Files
import java.nio.file.Path

@Component
class LocalDirectoryAccess : DirectoryAccess {
    override fun resolve(directory: String): Either<Failure, String> = try {
        require(directory.isNotBlank())
        val path = Path.of(directory).toRealPath()
        if (Files.isDirectory(path) && Files.isReadable(path)) Either.Right(path.toString())
        else Either.Left(Failure.Invalid("campaign.directory", "Choose an available, readable directory."))
    } catch (_: Exception) { Either.Left(Failure.Invalid("campaign.directory", "Choose an available, readable directory.")) }
}
