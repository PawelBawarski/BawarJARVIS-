package jarvis.offline;

import java.io.IOException;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/** Optional, explicit HTTPS preview; no crawler, no automatic ingestion. */
public final class WebPreviewer {
    public record Preview(String id,String title,String url,String text,Instant expires){}
    private final Map<String,Preview> previews=new ConcurrentHashMap<>();
    private static final Set<String> ALLOWED=Set.of("docs.oracle.com","angular.dev","spring.io","developer.mozilla.org","en.wikipedia.org","pl.wikipedia.org");
    private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
        .followRedirects(HttpClient.Redirect.NEVER).build();
    public Preview fetch(String value)throws Exception{
        if(value==null||value.length()>1000)throw new IllegalArgumentException("INVALID_URL");
        URI u;
        try{u=URI.create(value);}catch(RuntimeException e){throw new IllegalArgumentException("INVALID_URL");}
        if(!"https".equalsIgnoreCase(u.getScheme())||u.getHost()==null||!ALLOWED.contains(u.getHost().toLowerCase(Locale.ROOT))
            ||u.getPort()!=-1||u.getUserInfo()!=null||u.getFragment()!=null)throw new IllegalArgumentException("URL_NOT_ALLOWLISTED");
        for(InetAddress a:InetAddress.getAllByName(u.getHost())){
            if(a.isAnyLocalAddress()||a.isLoopbackAddress()||a.isSiteLocalAddress()||a.isLinkLocalAddress()||a.isMulticastAddress())
                throw new IllegalArgumentException("URL_RESOLVES_TO_PRIVATE_IP");
        }
        var request=HttpRequest.newBuilder(u).GET().timeout(Duration.ofSeconds(12)).header("User-Agent","Jarvis-Offline-Learning/1.0").build();
        var response=client.send(request,HttpResponse.BodyHandlers.ofInputStream());
        if(response.statusCode()!=200)throw new IllegalArgumentException("HTTP_STATUS_"+response.statusCode());
        String mime=response.headers().firstValue("content-type").orElse("").toLowerCase(Locale.ROOT);
        if(!(mime.startsWith("text/html")||mime.startsWith("text/plain")))throw new IllegalArgumentException("UNSUPPORTED_CONTENT_TYPE");
        byte[] raw;
        try(var in=response.body()) {raw=in.readNBytes(200_001);}
        if(raw.length>200_000)throw new IllegalArgumentException("WEB_CONTENT_TOO_LARGE");
        String html=new String(raw,StandardCharsets.UTF_8);
        String title=u.getHost();
        var matcher=Pattern.compile("(?is)<title[^>]*>(.*?)</title>").matcher(html);
        if(matcher.find())title=unescape(matcher.group(1).replaceAll("\\s+"," ").trim());
        String body=html.replaceAll("(?is)<(script|style|noscript|svg)\\b[^>]*>.*?</\\1>"," ")
            .replaceAll("(?s)<[^>]+>"," ").replaceAll("\\s+"," ").trim();
        body=unescape(body);
        if(body.length()>35_000)body=body.substring(0,35_000);
        if(body.length()<80)throw new IllegalArgumentException("NO_READABLE_TEXT");
        if(previews.size()>50)previews.entrySet().removeIf(e->e.getValue().expires().isBefore(Instant.now()));
        if(previews.size()>50)throw new IllegalArgumentException("TOO_MANY_PREVIEWS");
        Preview p=new Preview(UUID.randomUUID().toString(),title.substring(0,Math.min(160,title.length())),u.toString(),body,Instant.now().plusSeconds(600));
        previews.put(p.id(),p);return p;
    }
    public Preview approve(String id){
        Preview p=previews.remove(id);
        if(p==null||p.expires().isBefore(Instant.now()))throw new IllegalArgumentException("PREVIEW_EXPIRED_OR_MISSING");
        return p;
    }
    private String unescape(String s){return s.replace("&nbsp;"," ").replace("&quot;","\"").replace("&apos;","'").replace("&lt;","<").replace("&gt;",">").replace("&amp;","&");}
    public static Set<String> allowlist(){return ALLOWED;}
}
