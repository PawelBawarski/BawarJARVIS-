package jarvis.offline;

import java.util.LinkedHashMap;
import java.util.Map;

/** Minimal strict JSON parser for flat request objects; no third-party dependencies. */
public final class Json {
    private final String text;
    private int pos;
    private Json(String text) { this.text = text; }

    public static Map<String,Object> parseObject(String json) {
        if (json == null || json.length() > 250_000) throw new IllegalArgumentException("JSON_TOO_LARGE");
        var p = new Json(json);
        var result = p.object();
        p.ws();
        if (p.pos != p.text.length()) throw new IllegalArgumentException("JSON_TRAILING_DATA");
        return result;
    }
    private Map<String,Object> object() {
        expect('{'); ws();
        var r = new LinkedHashMap<String,Object>();
        if (peek('}')) { pos++; return r; }
        while (true) {
            ws(); var key = string(); ws(); expect(':'); ws();
            if (r.containsKey(key)) throw new IllegalArgumentException("JSON_DUPLICATE_KEY");
            if (peek('"')) r.put(key, string());
            else if (starts("true")) { pos+=4; r.put(key, true); }
            else if (starts("false")) { pos+=5; r.put(key, false); }
            else if (starts("null")) { pos+=4; r.put(key, null); }
            else throw new IllegalArgumentException("JSON_UNSUPPORTED_VALUE");
            ws(); if (peek('}')) { pos++; return r; }
            expect(',');
        }
    }
    private String string() {
        expect('"'); var sb = new StringBuilder();
        while (pos < text.length()) {
            char c=text.charAt(pos++);
            if (c=='"') return sb.toString();
            if (c=='\\') {
                if (pos>=text.length()) throw new IllegalArgumentException("JSON_ESCAPE");
                char e=text.charAt(pos++);
                switch (e) {
                    case '"','\\','/' -> sb.append(e);
                    case 'b' -> sb.append('\b');
                    case 'f' -> sb.append('\f');
                    case 'n' -> sb.append('\n');
                    case 'r' -> sb.append('\r');
                    case 't' -> sb.append('\t');
                    case 'u' -> {
                        if (pos+4>text.length()) throw new IllegalArgumentException("JSON_UNICODE");
                        try { sb.append((char)Integer.parseInt(text.substring(pos,pos+4),16)); }
                        catch(NumberFormatException ex){ throw new IllegalArgumentException("JSON_UNICODE"); }
                        pos+=4;
                    }
                    default -> throw new IllegalArgumentException("JSON_ESCAPE");
                }
            } else if (c<32) throw new IllegalArgumentException("JSON_CONTROL");
            else sb.append(c);
        }
        throw new IllegalArgumentException("JSON_UNTERMINATED_STRING");
    }
    private boolean starts(String s){return text.startsWith(s,pos);}
    private void ws(){while(pos<text.length() && " \r\n\t".indexOf(text.charAt(pos))>=0)pos++;}
    private boolean peek(char c){return pos<text.length() && text.charAt(pos)==c;}
    private void expect(char c){if(!peek(c))throw new IllegalArgumentException("JSON_EXPECTED_"+c);pos++;}
    public static String quote(String s) {
        if (s==null) return "null";
        var b=new StringBuilder("\"");
        for (char c:s.toCharArray()) {
            switch(c){
                case '"' -> b.append("\\\"");
                case '\\' -> b.append("\\\\");
                case '\n' -> b.append("\\n");
                case '\r' -> b.append("\\r");
                case '\t' -> b.append("\\t");
                default -> { if(c<32) b.append(String.format("\\u%04x",(int)c)); else b.append(c); }
            }
        }
        return b.append('"').toString();
    }
    public static String obj(Map<String,?> m) {
        var b=new StringBuilder("{"); boolean first=true;
        for(var e:m.entrySet()){
            if(!first)b.append(','); first=false;
            b.append(quote(e.getKey())).append(':').append(value(e.getValue()));
        }
        return b.append('}').toString();
    }
    public static String value(Object o) {
        if(o==null)return "null";
        if(o instanceof String s)return quote(s);
        if(o instanceof Boolean || o instanceof Integer || o instanceof Long)return o.toString();
        if(o instanceof Double d)return Double.isFinite(d)?d.toString():"null";
        if(o instanceof Float f)return Float.isFinite(f)?f.toString():"null";
        if(o instanceof Map<?,?> m){
            var cast=new LinkedHashMap<String,Object>();
            m.forEach((k,v)->cast.put(String.valueOf(k),v));
            return obj(cast);
        }
        if(o instanceof Iterable<?> it){
            var b=new StringBuilder("["); boolean first=true;
            for(Object x:it){if(!first)b.append(',');first=false;b.append(value(x));}
            return b.append(']').toString();
        }
        throw new IllegalArgumentException("JSON_UNSUPPORTED_SERIALIZATION");
    }
    public static String str(Map<String,Object> map,String key,int max,boolean required){
        Object v=map.get(key);
        if(v==null && !required)return "";
        if(!required && v instanceof String optional && optional.isBlank())return "";
        if(!(v instanceof String s) || s.isBlank() || s.length()>max) throw new IllegalArgumentException("INVALID_"+key.toUpperCase());
        return s.trim();
    }
    private Json() { this.text=""; }
}
