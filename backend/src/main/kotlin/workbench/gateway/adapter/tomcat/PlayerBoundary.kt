package workbench.gateway.adapter.tomcat

import jakarta.servlet.DispatcherType
import jakarta.servlet.Filter
import jakarta.servlet.FilterChain
import jakarta.servlet.ServletRequest
import jakarta.servlet.ServletResponse
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.apache.catalina.connector.Request
import org.apache.catalina.connector.Response
import org.apache.catalina.valves.ValveBase
import workbench.gateway.application.GatewayService

/** Explicit transport routes; Sharing authenticates identity and pairing inside each admitted call. */
internal object PlayerRoutes {
    const val MARKER = "workbench.gateway.playerRequest"
    const val OPERATION = "workbench.gateway.operation"
    fun allowed(method: String, path: String) = when (path) {
        "/player-api/readiness", "/player-api/me" -> method == "GET"
        "/player-api/pair" -> method == "POST"
        else -> false
    }
    fun deny(response: HttpServletResponse) {
        response.status = 404
        response.contentType = "text/plain"
        response.setHeader("Cache-Control", "no-store")
        response.writer.write("Not found")
    }
}

/** Runs before the servlet pipeline. Connector identity cannot be supplied through HTTP headers. */
class PlayerBoundary(private val listener: TomcatGatewayListener, private val gateway: GatewayService) : ValveBase(true) {
    override fun invoke(request: Request, response: Response) {
        if (listener.isPrivate(request.connector)) {
            next.invoke(request, response)
            return
        }
        if (!listener.isPlayer(request.connector) || !PlayerRoutes.allowed(request.method, request.requestURI) ||
            request.requestURI != request.decodedRequestURI) {
            PlayerRoutes.deny(response); return
        }
        val operation = gateway.admit()
        if (operation == null) { PlayerRoutes.deny(response); return }
        request.setAttribute(PlayerRoutes.MARKER, true)
        request.setAttribute(PlayerRoutes.OPERATION, operation)
        // No asynchronous handlers are admitted: release must follow the operation's transaction.
        request.isAsyncSupported = false
        try { next.invoke(request, response) } finally { operation.close() }
    }
}

/** A forward/include/error dispatch bypasses engine valves, so reject it at the servlet boundary. */
class PlayerDispatchBoundary : Filter {
    override fun doFilter(request: ServletRequest, response: ServletResponse, chain: FilterChain) {
        if (request.getAttribute(PlayerRoutes.MARKER) == true) {
            val http = request as HttpServletRequest
            if (http.dispatcherType != DispatcherType.REQUEST || !PlayerRoutes.allowed(http.method, http.requestURI)) {
                PlayerRoutes.deny(response as HttpServletResponse); return
            }
        }
        chain.doFilter(request, response)
    }
}
