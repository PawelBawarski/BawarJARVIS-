package pl.bawar.jarvis.lab.lora;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class LoraEvidenceServiceTest {
 @Test void rejectsUnreviewedOrEmptyAnswers(){
  assertThrows(IllegalArgumentException.class,()->LoraEvidenceService.validateReview(new LoraEvidenceService.Review("Pytanie"," ",true)));
  assertDoesNotThrow(()->LoraEvidenceService.validateReview(new LoraEvidenceService.Review("Pytanie","Zweryfikowana odpowiedź",true)));
 }
 @Test void rejectsLocalUrls(){
  assertFalse(LoraEvidenceService.safeSource("http://127.0.0.1/"));
  assertFalse(LoraEvidenceService.safeSource("file:///etc/passwd"));
  assertTrue(LoraEvidenceService.safeSource("https://example.com/article"));
 }
}
