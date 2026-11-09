package jarvis.offline;

import java.math.BigDecimal;
import java.math.MathContext;
import java.util.Optional;

/** Arithmetic only, no eval, functions or code execution. */
final class Calculator {
    private final String s;private int i;
    private Calculator(String s){this.s=s.replace(',','.');}
    static Optional<String> maybe(String input){
        String q=input.trim().replaceFirst("(?i)^oblicz\\s*:?\\s*","");
        if(!q.matches("[0-9+*/().,\\-\\s]{3,120}")||!q.matches(".*[+*/\\-].*"))return Optional.empty();
        try{
            var p=new Calculator(q);BigDecimal n=p.expr();p.ws();if(p.i!=p.s.length())return Optional.empty();
            return Optional.of(n.stripTrailingZeros().toPlainString());
        }catch(RuntimeException ex){return Optional.empty();}
    }
    private void ws(){while(i<s.length()&&Character.isWhitespace(s.charAt(i)))i++;}
    private boolean take(char c){ws();if(i<s.length()&&s.charAt(i)==c){i++;return true;}return false;}
    private BigDecimal expr(){BigDecimal r=term();while(true){if(take('+'))r=r.add(term());else if(take('-'))r=r.subtract(term());else break;}return r;}
    private BigDecimal term(){BigDecimal r=factor();while(true){if(take('*'))r=r.multiply(factor());else if(take('/'))r=r.divide(factor(),MathContext.DECIMAL64);else break;}return r;}
    private BigDecimal factor(){ws();if(take('-'))return factor().negate();if(take('+'))return factor();if(take('(')){var r=expr();if(!take(')'))throw new IllegalArgumentException();return r;}
        int start=i;while(i<s.length()&&(Character.isDigit(s.charAt(i))||s.charAt(i)=='.'))i++;
        if(i==start)throw new IllegalArgumentException();return new BigDecimal(s.substring(start,i));
    }
}
