package jarvis.offline;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.Executors;

/** Loopback-only local service. Does not launch other programs or read project files. */
public final class ServerMain {
    private final LocalStore store;
    private final BrainEngine brain;
    private final WebPreviewer web=new WebPreviewer();
    private final String token;
    private final HttpServer server;
    private static final Set<String> ORIGINS=Set.of("http://localhost:4200","http://127.0.0.1:4200","jarvis://app");

    public ServerMain(Path data,int port)throws IOException{
        store=new LocalStore(data);brain=new BrainEngine(store);
        var tokenFile=store.dir().resolve("local-api-token.txt");
        if(Files.isSymbolicLink(tokenFile))throw new IOException("TOKEN_SYMLINK_FORBIDDEN");
        if(Files.exists(tokenFile))token=Files.readString(tokenFile).trim();
        else{
            byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);
            token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            try{Files.writeString(tokenFile,token,StandardOpenOption.CREATE_NEW);}catch(FileAlreadyExistsException ex){throw new IOException("TOKEN_RACE");}
            try{Files.setPosixFilePermissions(tokenFile,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));}
            catch(UnsupportedOperationException ignored){ /* Windows: account permissions on user profile control access. */ }
        }
        if(token.length()<32)throw new IOException("INVALID_STORED_TOKEN");
        server=HttpServer.create(new InetSocketAddress("127.0.0.1",port),0);
        server.createContext("/api/ai/",this::serve);
        server.setExecutor(Executors.newFixedThreadPool(4,r->{Thread t=new Thread(r,"jarvis-api");t.setDaemon(true);return t;}));
    }
    public void start(){server.start();}
    public void stop(){server.stop(0);}
    public int port(){return server.getAddress().getPort();}
    public String token(){return token;}
    private void serve(HttpExchange e)throws IOException{
        try{
            String origin=e.getRequestHeaders().getFirst("Origin");
            e.getResponseHeaders().set("X-Content-Type-Options","nosniff");
            e.getResponseHeaders().set("Cache-Control","no-store");
            if(origin!=null){
                if(!ORIGINS.contains(origin)){send(e,403,Map.of("error","ORIGIN_FORBIDDEN"));return;}
                e.getResponseHeaders().set("Access-Control-Allow-Origin",origin);
                e.getResponseHeaders().set("Vary","Origin");
                e.getResponseHeaders().set("Access-Control-Allow-Headers","Content-Type, X-Jarvis-Token");
                e.getResponseHeaders().set("Access-Control-Allow-Methods","GET, POST, OPTIONS");
            }
            if("OPTIONS".equals(e.getRequestMethod())){e.sendResponseHeaders(204,-1);return;}
            String path=e.getRequestURI().getPath();String method=e.getRequestMethod();
            if(path.equals("/api/ai/health")&&method.equals("GET")){send(e,200,Map.of("ok",true,"mode","offline","llm",false));return;}
            if(!token.equals(e.getRequestHeaders().getFirst("X-Jarvis-Token"))){send(e,401,Map.of("error","AUTH_REQUIRED"));return;}
            if(!method.equals("GET")&&!method.equals("POST")){send(e,405,Map.of("error","METHOD_NOT_ALLOWED"));return;}
            Map<String,Object> body=method.equals("POST")?Json.parseObject(readBody(e)):Map.of();
            Map<String,Object> result;
            switch(method+" "+path){
                case "GET /api/ai/status" -> result=brain.status();
                case "GET /api/ai/knowledge" -> {
                    var docs=new ArrayList<Map<String,Object>>();
                    for(var d:store.documents())docs.add(Map.of("id",d.id(),"title",d.title(),"source",d.source(),"origin",d.origin()));
                    result=Map.of("documents",docs);
                }
                case "POST /api/ai/knowledge" -> {
                    var doc=store.add(Json.str(body,"title",160,true),Json.str(body,"source",1000,false),
                        Json.str(body,"content",100_000,true),"manual");
                    result=Map.of("id",doc.id(),"title",doc.title());
                }
                case "POST /api/ai/knowledge/delete" -> {
                    store.remove(Json.str(body,"id",80,true));result=Map.of("deleted",true);
                }
                case "POST /api/ai/ask" -> result=brain.ask(Json.str(body,"question",2000,true));
                case "POST /api/ai/reason" -> result=brain.reason(Json.str(body,"question",2000,true));
                case "POST /api/ai/feedback" -> {
                    Object v=body.get("positive");if(!(v instanceof Boolean flag))throw new IllegalArgumentException("INVALID_POSITIVE");
                    store.feedback(Json.str(body,"question",2000,true),Json.str(body,"documentId",80,true),flag);
                    result=Map.of("recorded",true);
                }
                case "POST /api/ai/train" -> result=brain.train();
                case "POST /api/ai/rollback" -> {store.rollbackModel();result=Map.of("rolledBack",true);}
                case "POST /api/ai/web/preview" -> {
                    var p=web.fetch(Json.str(body,"url",1000,true));
                    result=Map.of("previewId",p.id(),"title",p.title(),"source",p.url(),"preview",p.text().substring(0,Math.min(2000,p.text().length())),"expiresInSeconds",600);
                }
                case "POST /api/ai/web/approve" -> {
                    var p=web.approve(Json.str(body,"previewId",80,true));
                    var doc=store.add(p.title(),p.url(),p.text(),"web-approved");result=Map.of("id",doc.id(),"approved",true);
                }
                default -> {send(e,404,Map.of("error","NOT_FOUND"));return;}
            }
            send(e,200,result);
        }catch(IllegalArgumentException ex){send(e,400,Map.of("error",ex.getMessage()==null?"BAD_REQUEST":ex.getMessage()));}
        catch(Exception ex){System.err.println("Request failed: "+ex.getClass().getSimpleName());send(e,500,Map.of("error","INTERNAL_ERROR"));}
        finally{e.close();}
    }
    private String readBody(HttpExchange e)throws IOException{
        try(var stream=e.getRequestBody()){
            byte[] b=stream.readNBytes(250_001);
            if(b.length>250_000)throw new IllegalArgumentException("BODY_TOO_LARGE");
            return new String(b,StandardCharsets.UTF_8);
        }
    }
    private void send(HttpExchange e,int status,Map<String,?> payload)throws IOException{
        byte[] bytes=Json.obj(payload).getBytes(StandardCharsets.UTF_8);
        e.getResponseHeaders().set("Content-Type","application/json; charset=utf-8");
        e.sendResponseHeaders(status,bytes.length);
        try(var out=e.getResponseBody()){out.write(bytes);}
    }
    public static void main(String[] args)throws Exception{
        Path home=Path.of(System.getProperty("user.home"),".jarvis-ai");
        if(args.length>=2&&args[0].equals("--data-dir"))home=Path.of(args[1]);
        var app=new ServerMain(home,8766);app.start();
        System.out.println("JARVIS_OFFLINE_BRAIN_URL=http://127.0.0.1:8766");
        System.out.println("JARVIS_OFFLINE_BRAIN_TOKEN="+app.token());
        System.out.println("Local data directory: "+home.toAbsolutePath());
        System.out.println("Ctrl+C stops the service. Internet learning is opt-in only.");
    }
}
