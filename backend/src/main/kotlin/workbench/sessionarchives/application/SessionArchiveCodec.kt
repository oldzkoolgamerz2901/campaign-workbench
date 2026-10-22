package workbench.sessionarchives.application

import arrow.core.Either
import workbench.platform.api.Failure
import workbench.preparation.api.Archive

interface SessionArchiveCodec {
    fun readTransfer(bytes: ByteArray): Either<Failure, workbench.sessionarchives.api.SessionTransfer>
    fun writeTransfer(archive: workbench.sessionarchives.api.SessionTransfer): ByteArray
    fun read(bytes: ByteArray): Either<Failure, Archive>
    fun readIllustrated(bytes: ByteArray): Either<Failure, Archive>
    fun write(archive: Archive): ByteArray
}
