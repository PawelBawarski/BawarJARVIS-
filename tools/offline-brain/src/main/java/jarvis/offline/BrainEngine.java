package jarvis.offline;

import java.io.IOException;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Offline retrieval + explicit evidence planning; this is not a generative LLM. */
public final class BrainEngine {
    private final LocalStore store;
    public BrainEngine(LocalStore store){this.store=store;}
    private static final Pattern WORD=Pattern.compile("[\\p{L}\\p{Nd}]{2,}");
    private static final Set<String> STOP=Set.of("oraz","jest","jako","tego","tych","ktory","ktora","ktore","czyli","przez","przed","jestem","what","where","which","with","this","that","from","about","jakie","jaki","jak","czy","dla","nie","sie","się","ten","tam","and","the","are","was","moze","może","czym","która","który","kiedy","jaka","itp");
    public record Candidate(LocalStore.Doc doc,double score){}
    public static String normalize(String s){
        return Normalizer.normalize(s.toLowerCase(Locale.ROOT),Normalizer.Form.NFKD)
            .replace('ł','l').replace('Ł','l').replaceAll("\\p{M}","");
    }
    private static Set<String> tokens(String s){
        var m=WORD.matcher(normalize(s));var out=new LinkedHashSet<String>();
        while(m.find()) {String w=m.group();if(!STOP.contains(w) && w.length()>2)out.add(w);if(out.size()>15_000)break;}
        return out;
    }
    public static double[] features(String question,LocalStore.Doc doc){
        Set<String> q=tokens(question), c=tokens(doc.content()), t=tokens(doc.title());
        if(q.isEmpty())return new double[]{1,0,0,0};
        long both=q.stream().filter(c::contains).count(), title=q.stream().filter(t::contains).count();
        double phrase=normalize(doc.content()).contains(normalize(question).trim()) ? 1 : 0;
        return new double[]{1, (double)both/q.size(), (double)title/q.size(),phrase};
    }
    private static double sigmoid(double x){return x>=0?1/(1+Math.exp(-x)):Math.exp(x)/(1+Math.exp(x));}
    public static double predict(double[] weights,double[] feats){
        double z=0;for(int i=0;i<4;i++)z+=weights[i]*feats[i];return sigmoid(z);
    }
    public List<Candidate> rank(String query)throws IOException{
        if(query==null||query.isBlank()||query.length()>2_000)throw new IllegalArgumentException("INVALID_QUESTION");
        var out=new ArrayList<Candidate>();double[] w=store.weights();
        for(var d:store.documents()){
            double[] feat=features(query,d);
            if(feat[1]==0 && feat[2]==0 && feat[3]==0)continue;
            out.add(new Candidate(d,predict(w,feat)));
        }
        out.sort(Comparator.comparingDouble(Candidate::score).reversed());
        return List.copyOf(out);
    }
    public Map<String,Object> ask(String question)throws IOException{
        String q=question==null?"":question.trim();
        if(q.isBlank()||q.length()>2_000)throw new IllegalArgumentException("INVALID_QUESTION");
        var arithmetic=Calculator.maybe(q);
        if(arithmetic.isPresent()){
            return Map.of("mode","calculator","answer",arithmetic.get(),"confidence",1.0,"sources",List.of(),"grounded",true);
        }
        var candidates=rank(q);
        if(candidates.isEmpty())return Map.of("mode","retrieval","answer","Nie mam wystarczających danych w lokalnej bazie wiedzy. Dodaj zweryfikowany dokument lub użyj kontrolowanego importu źródła.","confidence",0.0,"sources",List.of(),"grounded",false);
        var sources=new ArrayList<Map<String,Object>>();var passages=new ArrayList<String>();
        for(var c:candidates.stream().limit(3).toList()){
            sources.add(Map.of("id",c.doc().id(),"title",c.doc().title(),"source",c.doc().source(),"score",Math.round(c.score()*1000)/1000.0));
            String excerpt=extract(c.doc().content(),q);
            passages.add("["+c.doc().title()+"] "+excerpt);
        }
        return Map.of("mode","retrieval","answer","Znalezione fragmenty źródeł (nie jest to odpowiedź generowana przez LLM):\n"+String.join("\n\n",passages),"confidence",Math.round(candidates.get(0).score()*1000)/1000.0,"sources",sources,"grounded",true);
    }
    public Map<String,Object> reason(String question)throws IOException{
        Map<String,Object> result=ask(question);
        var steps=new ArrayList<Map<String,Object>>();
        steps.add(Map.of("step","route","summary",result.get("mode").equals("calculator")?"Zastosowano bezpieczny parser działań matematycznych":"Wybrano wyszukiwanie w lokalnych danych"));
        steps.add(Map.of("step","evidence","summary",Boolean.TRUE.equals(result.get("grounded"))?"Zidentyfikowano dane wspierające wynik":"Nie znaleziono wystarczających danych"));
        steps.add(Map.of("step","answer","summary","Zwrócono wynik z jawnym wskazaniem źródeł lub ograniczeń"));
        var r=new LinkedHashMap<String,Object>(result);r.put("steps",steps);r.put("reasoningType","tool-and-evidence-workflow");return r;
    }
    private String extract(String content,String question){
        String condensed=content.replaceAll("\\s+"," ").trim();
        if(condensed.length()<=450)return condensed;
        var words=tokens(question);
        int index=0,best=0;
        String lower=normalize(condensed);
        for(String w:words){int at=lower.indexOf(w);if(at>=0){index=at;best++;if(best>=1)break;}}
        int start=Math.max(0,index-80),end=Math.min(condensed.length(),start+450);
        return (start>0?"…":"")+condensed.substring(start,end)+(end<condensed.length()?"…":"");
    }
    public Map<String,Object> train()throws IOException{
        var docs=store.documents().stream().collect(Collectors.toMap(LocalStore.Doc::id,d->d));
        var all=new ArrayList<LocalStore.Feedback>();
        for(var f:store.feedback())if(docs.containsKey(f.documentId()))all.add(f);
        long positives=all.stream().filter(LocalStore.Feedback::positive).count();
        if(all.size()<8||positives<3||all.size()-positives<3)throw new IllegalArgumentException("TRAINING_NEEDS_8_SAMPLES_WITH_3_POSITIVE_AND_3_NEGATIVE");
        Collections.shuffle(all,new Random(42));
        int validCount=Math.max(2,all.size()/5);
        var valid=all.subList(0,validCount); var train=all.subList(validCount,all.size());
        double[] old=store.weights(),proposed=old.clone();
        double baseline=logLoss(valid,docs,old);
        for(int epoch=0;epoch<160;epoch++){
            for(var f:train){
                double[] x=features(f.question(),docs.get(f.documentId()));
                double delta=((f.positive()?1.0:0.0)-predict(proposed,x))*0.12;
                for(int j=0;j<4;j++) proposed[j]+=delta*x[j];
            }
        }
        double candidate=logLoss(valid,docs,proposed);
        boolean accept=candidate+1e-7<baseline;
        if(accept){
            // Refit on all available feedback only after passing a held-out evaluation.
            for(int epoch=0;epoch<80;epoch++)for(var f:all){
                double[] x=features(f.question(),docs.get(f.documentId()));
                double delta=((f.positive()?1.0:0.0)-predict(proposed,x))*0.05;
                for(int j=0;j<4;j++)proposed[j]+=delta*x[j];
            }
            store.archiveModel();store.weights(proposed);
        }
        return Map.of("accepted",accept,"samples",all.size(),"validationSamples",validCount,
            "baselineValidationLoss",Math.round(baseline*10000)/10000.0,
            "candidateValidationLoss",Math.round(candidate*10000)/10000.0,
            "message",accept?"Zaktualizowano mały model rankingu źródeł; to nie jest trening LLM.":"Odrzucono aktualizację, bo nie poprawiła wyniku walidacyjnego.");
    }
    private double logLoss(List<LocalStore.Feedback> samples,Map<String,LocalStore.Doc> docs,double[] weights){
        double sum=0;
        for(var f:samples){double prob=predict(weights,features(f.question(),docs.get(f.documentId())));
            prob=Math.max(1e-8,Math.min(1-1e-8,prob));
            sum-=f.positive()?Math.log(prob):Math.log(1-prob);
        }
        return sum/samples.size();
    }
    public Map<String,Object> status()throws IOException{
        var docs=store.documents();var feedback=store.feedback();
        return Map.of("knowledgeDocuments",docs.size(),"feedbackSamples",feedback.size(),"model","4-parameter-logistic-ranker", "llmAvailable",false,"gpuAccelerated",false,"offline",true,"weights",Arrays.stream(store.weights()).boxed().toList());
    }
}
