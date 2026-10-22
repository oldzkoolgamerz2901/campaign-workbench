package workbench.preparation.application

import arrow.core.Either
import workbench.platform.api.Failure
import workbench.preparation.api.Archive

interface SessionArchiveCodec {
    fun read(bytes: ByteArray): Either<Failure, Archive>
    fun readIllustrated(bytes: ByteArray): Either<Failure, Archive>
    fun write(archive: Archive): ByteArray
}
