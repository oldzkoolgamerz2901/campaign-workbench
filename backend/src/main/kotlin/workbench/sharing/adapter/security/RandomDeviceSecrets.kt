package workbench.sharing.adapter.security

import workbench.sharing.application.DeviceSecrets
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import java.util.HexFormat

class RandomDeviceSecrets : DeviceSecrets {
    private val random = SecureRandom()
    private val format = Regex("[A-Za-z0-9_-]{43}")
    override fun generate(): String = Base64.getUrlEncoder().withoutPadding().encodeToString(ByteArray(32).also(random::nextBytes))
    override fun hash(secret: String): String? = if (!format.matches(secret)) null else
        HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(secret.toByteArray(Charsets.US_ASCII)))
}
