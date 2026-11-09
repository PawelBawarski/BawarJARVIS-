package jarvis.offline;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.regex.Pattern;

/** Stores only application-owned data under a fixed directory; never accesses workspaces. */
public final class LocalStore {
    public record Doc(String id, String title, String source, String content, String origin) {}
    public record Feedback(String question,String documentId,boolean positive) {}
    private final Path dir;
    private static final Pattern SECRET=Pattern.compile("(?im)(?:api[_-]?key|authorization|bearer|password|passwd|access[_-]?token|private[_-]?key|secret)\\s*[:=]\\s*\\S+");
    private static final int MAX_DOCS=2_000, MAX_FEEDBACK=10_000;
    public LocalStore(Path root) throws IOException {
        this.dir=root.toAbsolutePath().normalize();
        Files.createDirectories(dir);
        if(Files.isSymbolicLink(dir))throw new IOException("DATA_DIR_SYMLINK_FORBIDDEN");
    }
    public Path dir(){return dir;}
    private Path path(String name){return dir.resolve(name);}
    public synchronized List<Doc> documents() throws IOException {
        var out=new ArrayList<Doc>();
        for(String line: lines("knowledge.tsv")){
            String[] a=line.split("\\t",-1);
            if(a.length==5){try{out.add(new Doc(a[0],dec(a[1]),dec(a[2]),dec(a[3]),dec(a[4])));}catch(IllegalArgumentException ignored){}}
        }
        return List.copyOf(out);
    }
    public synchronized Doc add(String title,String source,String content,String origin) throws IOException {
        if(title==null||title.isBlank()||title.length()>160)throw new IllegalArgumentException("INVALID_TITLE");
        if(source==null||source.length()>1_000)throw new IllegalArgumentException("INVALID_SOURCE");
        if(content==null||content.isBlank()||content.length()>100_000)throw new IllegalArgumentException("INVALID_CONTENT");
        if(SECRET.matcher(content).find())throw new IllegalArgumentException("POSSIBLE_SECRET_REJECTED");
        var docs=new ArrayList<>(documents());
        if(docs.size()>=MAX_DOCS)throw new IllegalArgumentException("KNOWLEDGE_LIMIT_REACHED");
        var doc=new Doc(UUID.randomUUID().toString(),title.trim(),source.trim(),content.trim(),origin);
        docs.add(doc); saveDocs(docs); return doc;
    }
    public synchronized void remove(String id)throws IOException{
        var docs=new ArrayList<>(documents());
        if(!docs.removeIf(d->d.id().equals(id)))throw new IllegalArgumentException("DOCUMENT_NOT_FOUND");
        saveDocs(docs);
    }
    private void saveDocs(List<Doc> docs)throws IOException{
        var b=new StringBuilder();
        for(Doc d:docs)b.append(d.id()).append('\t').append(enc(d.title())).append('\t').append(enc(d.source()))
            .append('\t').append(enc(d.content())).append('\t').append(enc(d.origin())).append('\n');
        atomicWrite("knowledge.tsv",b.toString());
    }
    public synchronized List<Feedback> feedback()throws IOException{
        var r=new ArrayList<Feedback>();
        for(String l:lines("feedback.tsv")){
            String[] a=l.split("\\t",-1);
            if(a.length==3){try{r.add(new Feedback(dec(a[0]),a[1],Boolean.parseBoolean(a[2])));}catch(IllegalArgumentException ignored){}}
        }
        return List.copyOf(r);
    }
    public synchronized void feedback(String question,String id,boolean positive)throws IOException{
        if(question==null||question.isBlank()||question.length()>2_000)throw new IllegalArgumentException("INVALID_QUESTION");
        if(documents().stream().noneMatch(x->x.id().equals(id)))throw new IllegalArgumentException("DOCUMENT_NOT_FOUND");
        var f=feedback(); if(f.size()>=MAX_FEEDBACK)throw new IllegalArgumentException("FEEDBACK_LIMIT_REACHED");
        var existing=Files.exists(path("feedback.tsv"))?Files.readString(path("feedback.tsv")):"";
        atomicWrite("feedback.tsv",existing+enc(question)+"\t"+id+"\t"+positive+"\n");
    }
    public synchronized double[] weights()throws IOException{
        var ls=lines("weights.txt");
        if(ls.isEmpty())return new double[]{-1.0,3.5,1.8,1.5};
        var s=ls.get(0).split(",");if(s.length!=4)return new double[]{-1.0,3.5,1.8,1.5};
        try{double[] r=new double[4];for(int i=0;i<4;i++)r[i]=Double.parseDouble(s[i]);return r;}
        catch(NumberFormatException e){return new double[]{-1.0,3.5,1.8,1.5};}
    }
    public synchronized void weights(double[] w)throws IOException{
        if(w.length!=4)throw new IllegalArgumentException("INVALID_WEIGHTS");
        for(double x:w)if(!Double.isFinite(x)||Math.abs(x)>100)throw new IllegalArgumentException("INVALID_WEIGHTS");
        atomicWrite("weights.txt",w[0]+","+w[1]+","+w[2]+","+w[3]+"\n");
    }
    public synchronized void rollbackModel()throws IOException{
        if(!Files.exists(path("weights.previous.txt")))throw new IllegalArgumentException("NO_MODEL_BACKUP");
        atomicWrite("weights.txt",Files.readString(path("weights.previous.txt")));
    }
    public synchronized void archiveModel()throws IOException{
        if(Files.exists(path("weights.txt")))atomicWrite("weights.previous.txt",Files.readString(path("weights.txt")));
        else atomicWrite("weights.previous.txt","-1.0,3.5,1.8,1.5\n");
    }
    private List<String> lines(String filename)throws IOException{
        Path file=path(filename);
        if(Files.isSymbolicLink(file))throw new IOException("DATA_FILE_SYMLINK_FORBIDDEN");
        return Files.exists(file)?Files.readAllLines(file,StandardCharsets.UTF_8):List.of();
    }
    private void atomicWrite(String filename,String content)throws IOException{
        Path target=path(filename);
        if(Files.isSymbolicLink(target))throw new IOException("DATA_FILE_SYMLINK_FORBIDDEN");
        Path temp=Files.createTempFile(dir,".write-",".tmp");
        try{
            Files.writeString(temp,content,StandardCharsets.UTF_8,StandardOpenOption.TRUNCATE_EXISTING);
            try{Files.move(temp,target,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}
            catch(AtomicMoveNotSupportedException ex){Files.move(temp,target,StandardCopyOption.REPLACE_EXISTING);}
        }finally{Files.deleteIfExists(temp);}
    }
    private static String enc(String s){return Base64.getUrlEncoder().withoutPadding().encodeToString(s.getBytes(StandardCharsets.UTF_8));}
    private static String dec(String s){return new String(Base64.getUrlDecoder().decode(s),StandardCharsets.UTF_8);}
}
