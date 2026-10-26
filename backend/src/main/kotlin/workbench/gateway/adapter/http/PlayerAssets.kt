package workbench.gateway.adapter.http

import tools.jackson.databind.ObjectMapper
import java.nio.file.Files
import java.nio.file.Path

/** Only files explicitly published by the completed player build may cross the LAN boundary. */
class PlayerAssets(private val directory: Path, private val mapper: ObjectMapper) {
    private val entries=setOf("/player/","/player/group","/player/mine","/player/pair")
    private val extension=Regex(".*\\.(js|css|png|svg|ico|woff2?|ttf)$")
    private fun manifest(): Map<String,Path>? = try {
        val root=directory.toRealPath()
        val marker=root.resolve("player-manifest.json")
        if(Files.size(marker)>262144) null else {
            val metadata=mapper.readValue(Files.readString(marker),Map::class.java)["files"] as? Map<*,*>
            val files=linkedMapOf<String,Path>()
            if(metadata==null || metadata.isEmpty() || metadata.size>1000) null else {
                for((key,value) in metadata) {
                    val name=key as? String ?: error("Invalid asset")
                    require(name.matches(Regex("[A-Za-z0-9_./-]+")) && name.split('/').none { it==".." || it.isEmpty() })
                    require(name=="index.html" || extension.matches(name))
                    val file=root.resolve(name)
                    require(!Files.isSymbolicLink(file) && Files.isRegularFile(file) && file.toRealPath().startsWith(root))
                    require(Files.size(file)==(value as Number).toLong())
                    files[name]=file
                }
                if("index.html" !in files) null else files
            }
        }
    } catch (_: Exception) { null }
    fun ready() = manifest()!=null
    fun resource(path: String): Path? {
        val files=manifest() ?: return null
        return if(path in entries) files["index.html"] else if(path.startsWith("/player/")) files[path.removePrefix("/player/")] else null
    }
    fun allowed(method: String,path: String) = method=="GET" && resource(path)!=null
}
