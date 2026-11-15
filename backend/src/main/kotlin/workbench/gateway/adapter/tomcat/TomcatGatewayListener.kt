package workbench.gateway.adapter.tomcat

import arrow.core.Either
import org.apache.catalina.connector.Connector
import org.apache.catalina.startup.Tomcat
import org.slf4j.LoggerFactory
import org.springframework.boot.tomcat.TomcatWebServer
import org.springframework.boot.web.server.servlet.context.ServletWebServerInitializedEvent
import org.springframework.context.event.EventListener
import workbench.gateway.application.GatewayListener
import workbench.platform.api.Failure

class TomcatGatewayListener(private val address: String, private val port: Int) : GatewayListener {
    init { require(port in 0..65535) }
    private val log = LoggerFactory.getLogger(javaClass)
    private var tomcat: Tomcat? = null
    @Volatile private var privateConnector: Connector? = null
    @Volatile private var lanConnector: Connector? = null

    @EventListener
    fun initialized(event: ServletWebServerInitializedEvent) {
        val server = event.webServer as? TomcatWebServer ?: error("Gateway requires embedded Tomcat.")
        tomcat = server.tomcat
        privateConnector = server.tomcat.connector
    }

    fun isPrivate(connector: Connector) = connector === privateConnector
    fun isPlayer(connector: Connector) = connector === lanConnector

    @Synchronized
    override fun open(): Either<Failure, Int> {
        val server = tomcat ?: return Either.Left(failure("Gateway server is not ready."))
        if (lanConnector != null) return Either.Left(failure("The previous gateway connector has not closed."))
        val connector = Connector("org.apache.coyote.http11.Http11NioProtocol").apply {
            setPort(this@TomcatGatewayListener.port)
            setProperty("address", address)
            // Bound resource use; ordinary synchronous player HTTP only in G1.
            setProperty("maxThreads", "32")
            setProperty("maxConnections", "128")
            setProperty("connectionTimeout", "5000")
        }
        lanConnector = connector
        return try {
            server.service.addConnector(connector)
            check(connector.state.isAvailable && connector.localPort > 0) { "Connector did not start." }
            Either.Right(connector.localPort)
        } catch (ex: Exception) {
            log.warn("Gateway bind failed", ex)
            close()
            Either.Left(failure("The gateway could not bind its configured address/port. Check whether the port is already in use."))
        }
    }

    @Synchronized
    override fun close(): Either<Failure, Unit> {
        val connector = lanConnector ?: return Either.Right(Unit)
        return try {
            connector.pause()
            connector.stop()
            tomcat?.service?.removeConnector(connector)
            connector.destroy()
            lanConnector = null
            Either.Right(Unit)
        } catch (ex: Exception) {
            // Keep the reference for a later cleanup retry; admission remains closed.
            log.warn("Gateway connector cleanup failed", ex)
            Either.Left(failure("Gateway admission is closed, but connector cleanup failed. Retry disabling the gateway."))
        }
    }

    private fun failure(message: String) = Failure.Conflict("gateway.listener", message)
}
