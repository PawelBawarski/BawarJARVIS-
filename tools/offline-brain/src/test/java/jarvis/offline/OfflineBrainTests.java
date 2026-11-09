package jarvis.offline;

import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.util.*;

/** Self-contained regression suite without JUnit or additional downloads. */
public final class OfflineBrainTests {
    static int passed=0;
    static void check(boolean condition,String message){if(!condition)throw new AssertionError(message);passed++;}
    static void throwsCode(Runnable r,String code){try{r.run();throw new AssertionError("Missing error: "+code);}catch(IllegalArgumentException ex){check(ex.getMessage().contains(code),"expected "+code+", got "+ex.getMessage());}}
    public static void main(String[] args)throws Exception{
        Path root=Files.createTempDirectory("jarvis-offline-tests-");
        try{
            var store=new LocalStore(root);var brain=new BrainEngine(store);
            check(store.documents().isEmpty(),"fresh store empty");
            var empty=brain.ask("Angular signals");
            check(Boolean.FALSE.equals(empty.get("grounded")),"unknown answer does not hallucinate");
            var math=brain.ask("(2+3)*4");
            check("20".equals(math.get("answer")),"calculator precedence");
            check(Calculator.maybe("12/0").isEmpty(),"zero division rejected");
            throwsCode(()->{try{store.add("private","", "password=supersecret", "manual");}catch(Exception ex){if(ex instanceof RuntimeException re)throw re;throw new RuntimeException(ex);}},"POSSIBLE_SECRET_REJECTED");
            var a=store.add("Angular Signals","manual:docs","Angular signals are reactive primitives that track values and notify consumers. Signals allow fine-grained updates.","manual");
            var b=store.add("Spring Boot","manual:docs","Spring Boot builds Java applications and HTTP APIs with auto configuration.","manual");
            check(store.documents().size()==2,"persistence count");
            check(new LocalStore(root).documents().size()==2,"reload from disk");
            var qa=brain.ask("Angular signals");
            check(Boolean.TRUE.equals(qa.get("grounded")),"retrieval grounding");
            check(qa.get("answer").toString().contains("Signals"),"answer has source excerpt");
            check(((List<?>)qa.get("sources")).size()>=1,"source pointers");
            check(((List<?>)brain.reason("Angular signals").get("steps")).size()==3,"reasoning workflow");
            check(Json.parseObject("{\"x\":\"te\\\\st\",\"ok\":true}").get("ok").equals(true),"strict json parsing");
            throwsCode(()->Json.parseObject("{\"x\":1}"),"JSON_UNSUPPORTED_VALUE");
            throwsCode(()->Json.parseObject("{\"x\":true,\"x\":false}"),"JSON_DUPLICATE_KEY");
            double[] old=store.weights();
            for(int i=0;i<10;i++){
                store.feedback(i%2==0?"Angular signals":"Spring Boot",a.id(),i%2==0);
                store.feedback(i%2==1?"Angular signals":"Spring Boot",b.id(),i%2==0);
            }
            var training=brain.train();
            check(training.containsKey("accepted")&&training.containsKey("validationSamples"),"training reports validation");
            check(store.feedback().size()==20,"feedback persists");
            check(store.weights().length==4,"learned model weight vector");
            if(Boolean.TRUE.equals(training.get("accepted"))){
                store.rollbackModel();
                check(Arrays.equals(store.weights(),old),"model rollback");
            }
            throwsCode(()->{Json.parseObject("[]");},"JSON_EXPECTED_{");
            var preview=new WebPreviewer();
            check(WebPreviewer.allowlist().contains("docs.oracle.com"),"bounded source hosts");
            try{preview.fetch("http://127.0.0.1/private");throw new AssertionError("URL blocked expected");}
            catch(IllegalArgumentException ex){check(ex.getMessage().equals("URL_NOT_ALLOWLISTED"),"SSRF private URL blocked");}
            var server=new ServerMain(root,0);server.start();
            try{
                var client=HttpClient.newHttpClient();String base="http://127.0.0.1:"+server.port();
                var res=client.send(HttpRequest.newBuilder(URI.create(base+"/api/ai/health")).GET().build(),HttpResponse.BodyHandlers.ofString());
                check(res.statusCode()==200,"health available");
                res=client.send(HttpRequest.newBuilder(URI.create(base+"/api/ai/status")).GET().build(),HttpResponse.BodyHandlers.ofString());
                check(res.statusCode()==401,"API token required");
                res=client.send(HttpRequest.newBuilder(URI.create(base+"/api/ai/status")).header("X-Jarvis-Token",server.token()).GET().build(),HttpResponse.BodyHandlers.ofString());
                check(res.statusCode()==200,"valid API token accepted");
                res=client.send(HttpRequest.newBuilder(URI.create(base+"/api/ai/status")).header("Origin","https://evil.example").header("X-Jarvis-Token",server.token()).GET().build(),HttpResponse.BodyHandlers.ofString());
                check(res.statusCode()==403,"unexpected browser origin rejected");
                res=client.send(HttpRequest.newBuilder(URI.create(base+"/api/ai/reason")).header("X-Jarvis-Token",server.token()).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString("{\"question\":\"2+2\"}")).build(),HttpResponse.BodyHandlers.ofString());
                check(res.statusCode()==200&&res.body().contains("\"answer\":\"4\""),"HTTP reason endpoint computes safely");
            }finally{server.stop();}
            store.remove(a.id());check(store.documents().size()==1,"knowledge remove affects own storage only");
            System.out.println("PASS: "+passed+" local Java assertions");
        }finally{deleteTree(root);}
    }
    static void deleteTree(Path p)throws Exception{try(var s=Files.walk(p)){for(var path:s.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(path);}}
}
