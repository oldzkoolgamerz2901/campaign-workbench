package workbench

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.web.server.context.WebServerApplicationContext
import org.springframework.boot.web.server.WebServerFactoryCustomizer
import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory
import org.springframework.boot.web.error.ErrorPage
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.http.HttpStatus
import org.springframework.web.servlet.HandlerInterceptor
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer
import org.springframework.web.servlet.config.annotation.InterceptorRegistry
import org.testcontainers.postgresql.PostgreSQLContainer
import workbench.campaigns.api.RegisterCampaign
import workbench.campaigns.application.CampaignService
import workbench.gateway.application.GatewayService
import java.net.URI
import java.net.Socket
import java.net.ServerSocket
import java.net.http.*
import java.nio.file.Files
import java.util.UUID
import java.util.concurrent.*

class GatewayProbe {
    @Volatile var entered = CountDownLatch(1)
    @Volatile var release = CountDownLatch(1)
}
@TestConfiguration(proxyBeanMethods = false)
class GatewayProbeConfiguration {
    @Bean fun gatewayProbe() = GatewayProbe()
    @Bean fun probeInterceptor(probe: GatewayProbe) = object : WebMvcConfigurer {
        override fun addInterceptors(registry: InterceptorRegistry) {
            registry.addInterceptor(object : HandlerInterceptor {
                override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
                    if (request.requestURI != "/player-api/readiness") return true
                    when (request.getParameter("probe")) {
                        "forward" -> { request.getRequestDispatcher("/api/status").forward(request,response); return false }
                        "include" -> { request.getRequestDispatcher("/api/status").include(request,response); return false }
                        "error" -> { response.sendError(500); return false }
                        "async" -> { request.startAsync(); return false }
                        "hold" -> { probe.entered.countDown(); check(probe.release.await(10,TimeUnit.SECONDS)) }
                    }
                    return true
                }
            })
        }
    }
    @Bean fun probeErrors() = WebServerFactoryCustomizer<TomcatServletWebServerFactory> {
        it.addErrorPages(ErrorPage(HttpStatus.INTERNAL_SERVER_ERROR,"/api/status"))
    }
}

class GatewayIntegrationTest : StringSpec({
    val database=PostgreSQLContainer("postgres:${System.getProperty("workbench.postgres.version")}")
    val root=Files.createTempDirectory("gateway-integration")
    var context: ConfigurableApplicationContext?=null
    var dm=0
    lateinit var first: UUID
    lateinit var second: UUID
    fun gateway()=context!!.getBean(GatewayService::class.java)
    val client=HttpClient.newBuilder().connectTimeout(java.time.Duration.ofSeconds(3)).build()
    fun http(port: Int,path: String,method: String="GET",body: String=""): HttpResponse<String> = client.send(
        HttpRequest.newBuilder(URI("http://127.0.0.1:$port$path")).timeout(java.time.Duration.ofSeconds(15))
            .header("Content-Type","application/json").method(method,HttpRequest.BodyPublishers.ofString(body)).build(),
        HttpResponse.BodyHandlers.ofString())
    fun raw(port: Int,path: String,method: String="GET",headers: String=""): Pair<Int,String> = Socket("127.0.0.1",port).use { socket ->
        socket.soTimeout=5000
        socket.getOutputStream().write("$method $path HTTP/1.1\r\nHost: 127.0.0.1:$dm\r\nConnection: close\r\n$headers\r\n".toByteArray())
        val text=socket.getInputStream().bufferedReader().readText()
        text.lineSequence().first().split(" ")[1].toInt() to text
    }
    fun closed(port: Int): Boolean = try { Socket("127.0.0.1",port).close(); false } catch (_: java.io.IOException) { true }
    fun startPlayer() {
        gateway().disable().isRight() shouldBe true
        gateway().select(first).isRight() shouldBe true
        gateway().enable().isRight() shouldBe true
    }
    beforeSpec {
        database.start()
        context=SpringApplicationBuilder(CampaignWorkbenchApplication::class.java,GatewayProbeConfiguration::class.java).run(
            "--server.port=0","--server.address=0.0.0.0","--workbench.gateway.port=0","--workbench.gateway.drain-timeout-ms=300",
            "--spring.datasource.url=${database.jdbcUrl}","--spring.datasource.username=${database.username}","--spring.datasource.password=${database.password}")
        dm=(context as WebServerApplicationContext).webServer!!.port
        val campaigns=context!!.getBean(CampaignService::class.java)
        first=campaigns.register(RegisterCampaign("First",root.toString())).getOrNull()!!.id
        val other=Files.createDirectory(root.resolve("other"))
        second=campaigns.register(RegisterCampaign("Second",other.toString())).getOrNull()!!.id
    }
    afterSpec { context?.close(); database.stop(); root.toFile().deleteRecursively() }
    "default disabled; private controls and legacy selection contract; safe content type" {
        gateway().status().enabled shouldBe false
        http(dm,"/api/gateway/enable","POST").statusCode() shouldBe 409
        http(dm,"/api/campaigns/$first/selection","PUT").statusCode() shouldBe 200
        http(dm,"/api/gateway/enable","POST").let { check(it.statusCode()==200) { it.body() } }
        raw(dm,"/api/gateway/disable","POST","Content-Type: application/x-www-form-urlencoded\r\nContent-Length: 0\r\n").first shouldBe 415
        gateway().status().enabled shouldBe true
    }
    "real LAN connector denies private endpoints, path aliases, methods and spoofed headers" {
        startPlayer()
        val port=gateway().status().port!!
        http(port,"/player-api/readiness").statusCode() shouldBe 200
        http(dm,"/api/status").statusCode() shouldBe 200
        http(dm,"/v3/api-docs").statusCode() shouldBe 200
        val document=context!!.getBean(tools.jackson.databind.ObjectMapper::class.java)
            .readValue(http(dm,"/v3/api-docs").body(),Map::class.java)
        val privatePaths=(document["paths"] as Map<*,*>).filterKeys { !it.toString().startsWith("/player-api/") }
        val selection=((privatePaths["/api/campaigns/{id}/selection"] as Map<*,*>)["put"] as Map<*,*>)
        selection["operationId"] shouldBe "selectCampaign"
        (selection["tags"] as List<*>).contains("campaign-controller") shouldBe true
        var denied=0
        privatePaths.forEach { (path, operations) ->
            (operations as Map<*,*>).keys.filter { it in listOf("get","post","put","delete","patch","head","options") }.forEach { method ->
                val url=path.toString().replace(Regex("\\{[^}]+}"),first.toString())
                raw(port,url,method.toString().uppercase()).first shouldBe 404
                denied++
            }
        }
        println("G1 denied all $denied private OpenAPI operations on the LAN connector")
        http(port,"/player-api/readiness").headers().firstValue("Cache-Control").orElse("") shouldBe "no-store"
        val paths=listOf("/api/status","/api/campaigns","/api/gateway","/api/gateway/enable","/api/gateway/disable","/api/campaigns/$second/selection","/v3/api-docs","/swagger-ui/index.html","/actuator/health","/error","/","/application.properties","/card-placeholder.svg","/player-api/../api/status","/player-api/%2e%2e/api/status","//api/status","/%61pi/status","/player-api%2f..%2fapi%2fstatus","/player-api/readiness/","/player-api/readiness;anything","/player-api//readiness","/player-api/%72eadiness")
        paths.forEach { path ->
            val result=raw(port,path)
            (result.first in listOf(400,404)) shouldBe true
            result.second.contains("\"campaigns\"") shouldBe false
        }
        listOf("POST","PUT","DELETE","PATCH","HEAD","OPTIONS","TRACE").forEach {
            (raw(port,"/player-api/readiness",it).first in listOf(400,404,405)) shouldBe true
        }
        listOf("Forwarded: for=127.0.0.1;host=127.0.0.1:$dm\r\n","X-Forwarded-Host: 127.0.0.1:$dm\r\nX-Forwarded-Port: $dm\r\n","X-Original-URL: /api/status\r\nX-Rewrite-URL: /api/status\r\n").forEach {
            raw(port,"/api/status",headers=it).first shouldBe 404
        }
    }
    "servlet forward include error and async cannot reach private controllers" {
        startPlayer()
        val port=gateway().status().port!!
        listOf("forward","error").forEach { http(port,"/player-api/readiness?probe=$it").statusCode() shouldBe 404 }
        val include=http(port,"/player-api/readiness?probe=include")
        include.body().contains("\"status\":\"ready\"") shouldBe false
        include.body().contains("Not found") shouldBe true
        (http(port,"/player-api/readiness?probe=async").statusCode()!=200) shouldBe true
        gateway().status().activeRequests shouldBe 0
    }
    "repeated listener disable and enable closes ports and retains private API" {
        startPlayer()
        repeat(3) {
            val old=gateway().status().port!!
            http(dm,"/api/gateway/disable","POST").statusCode() shouldBe 200
            closed(old) shouldBe true
            http(dm,"/api/status").statusCode() shouldBe 200
            http(dm,"/api/gateway/enable","POST").statusCode() shouldBe 200
            http(gateway().status().port!!,"/player-api/readiness").statusCode() shouldBe 200
        }
    }
    "real admitted HTTP request times out selection without changing campaign and can finish safely" {
        startPlayer()
        val probe=context!!.getBean(GatewayProbe::class.java)
        probe.entered=CountDownLatch(1); probe.release=CountDownLatch(1)
        val port=gateway().status().port!!; val pool=Executors.newSingleThreadExecutor()
        try {
            val pending=pool.submit<HttpResponse<String>> { http(port,"/player-api/readiness?probe=hold") }
            probe.entered.await(3,TimeUnit.SECONDS) shouldBe true
            val change=http(dm,"/api/campaigns/$second/selection","PUT")
            change.statusCode() shouldBe 409
            context!!.getBean(CampaignService::class.java).selected().getOrNull() shouldBe first
            gateway().status().enabled shouldBe false
            probe.release.countDown()
            // Connector shutdown can close the HTTP response; the admitted operation still releases.
            try { pending.get(5,TimeUnit.SECONDS) } catch (_: ExecutionException) { }
            val deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(3)
            while(gateway().status().activeRequests>0 && System.nanoTime()<deadline) Thread.yield()
            gateway().status().activeRequests shouldBe 0
            closed(port) shouldBe true
            http(dm,"/api/campaigns/$second/selection","PUT").statusCode() shouldBe 200
            http(dm,"/api/gateway/enable","POST").statusCode() shouldBe 200
            gateway().status().campaign shouldBe second
        } finally { probe.release.countDown(); pool.shutdownNow() }
    }
    "private binding overrides a nonlocal address setting; occupied gateway port cleans up and can retry" {
        val server=context as org.springframework.boot.web.server.servlet.context.ServletWebServerApplicationContext
        val tomcat=(server.webServer as org.springframework.boot.tomcat.TomcatWebServer).tomcat
        tomcat.connector.getProperty("address").toString().contains("127.0.0.1") shouldBe true
        val occupied=ServerSocket(0,1,java.net.InetAddress.getByName("127.0.0.1"))
        val port=occupied.localPort
        val listener=workbench.gateway.adapter.tomcat.TomcatGatewayListener("127.0.0.1",port)
        listener.initialized(org.springframework.boot.web.server.servlet.context.ServletWebServerInitializedEvent(server.webServer!!,server))
        try {
            listener.open().isLeft() shouldBe true
            http(dm,"/api/status").statusCode() shouldBe 200
            occupied.close()
            listener.open().getOrNull() shouldBe port
            listener.close().isRight() shouldBe true
            closed(port) shouldBe true
            http(dm,"/api/status").statusCode() shouldBe 200
        } finally { occupied.close(); listener.close() }
    }
    "successful real HTTP drain completes before selection and leaves gateway disabled" {
        startPlayer()
        val probe=context!!.getBean(GatewayProbe::class.java)
        probe.entered=CountDownLatch(1); probe.release=CountDownLatch(1)
        val port=gateway().status().port!!; val pool=Executors.newFixedThreadPool(2)
        try {
            val pending=pool.submit<HttpResponse<String>> { http(port,"/player-api/readiness?probe=hold") }
            probe.entered.await(3,TimeUnit.SECONDS) shouldBe true
            val change=pool.submit<HttpResponse<String>> { http(dm,"/api/campaigns/$second/selection","PUT") }
            val deadline=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(200)
            while(gateway().status().enabled && System.nanoTime()<deadline) Thread.yield()
            gateway().status().enabled shouldBe false
            change.isDone shouldBe false
            context!!.getBean(CampaignService::class.java).selected().getOrNull() shouldBe first
            probe.release.countDown()
            pending.get(3,TimeUnit.SECONDS).statusCode() shouldBe 200
            change.get(3,TimeUnit.SECONDS).statusCode() shouldBe 200
            context!!.getBean(CampaignService::class.java).selected().getOrNull() shouldBe second
            closed(port) shouldBe true
            gateway().status().enabled shouldBe false
        } finally { probe.release.countDown(); pool.shutdownNow() }
    }
})
