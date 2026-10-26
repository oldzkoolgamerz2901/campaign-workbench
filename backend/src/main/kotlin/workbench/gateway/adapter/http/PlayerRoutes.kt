package workbench.gateway.adapter.http

import jakarta.servlet.http.HttpServletResponse

internal object PlayerRoutes {
    const val MARKER="workbench.gateway.playerRequest"
    const val OPERATION="workbench.gateway.operation"
    fun allowed(method: String,path: String,assets: PlayerAssets) = when(path) {
        "/player-api/readiness", "/player-api/me" -> method=="GET"
        "/player-api/pair" -> method=="POST"
        else -> assets.allowed(method,path)
    }
    fun deny(response: HttpServletResponse) {
        response.status=404
        response.contentType="text/plain"
        response.setHeader("Cache-Control","no-store")
        response.writer.write("Not found")
    }
}
