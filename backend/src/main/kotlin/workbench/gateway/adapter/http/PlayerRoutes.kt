package workbench.gateway.adapter.http

import jakarta.servlet.http.HttpServletResponse

internal object PlayerRoutes {
    const val MARKER="workbench.gateway.playerRequest"
    const val OPERATION="workbench.gateway.operation"
    fun allowed(method: String,path: String,assets: PlayerAssets) = when(path) {
        "/player-api/readiness", "/player-api/me", "/player-api/collections" -> method=="GET"
        "/player-api/pair" -> method=="POST"
        else -> (method=="POST" && Regex("/player-api/cards/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/(claim|remove)").matches(path)) || (method=="GET" && Regex("/player-api/cards/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/(artwork|layout)").matches(path)) || assets.allowed(method,path)
    }
    fun deny(response: HttpServletResponse) {
        response.status=404
        response.contentType="text/plain"
        response.setHeader("Cache-Control","no-store")
        response.writer.write("Not found")
    }
}
