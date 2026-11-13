package pl.bawar.jarvis.research;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class SemanticVectorTest {
    @Test void encodeRoundTripAndSimilarity() {
        float[] a = new float[1024];
        a[0] = 3; a[1] = 4;
        float[] b = SemanticVector.fromBytes(SemanticVector.toBytes(a), 1024);
        assertEquals(0.6, b[0], 0.00001);
        assertEquals(1.0, SemanticVector.similarity(b, b), 0.00001);
        assertEquals(-1, SemanticVector.similarity(b, new float[3]));
    }

    @Test void invalidVectorsAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> SemanticVector.normalize(new float[2]));
        float[] invalid = new float[32]; invalid[4] = Float.NaN;
        assertThrows(IllegalArgumentException.class, () -> SemanticVector.normalize(invalid));
        assertThrows(IllegalArgumentException.class, () -> SemanticVector.normalize(new float[32]));
        assertThrows(IllegalArgumentException.class, () -> SemanticVector.fromBytes(new byte[9], 32));
    }

    @Test void changingDocumentInvalidatesHash() {
        assertNotEquals(SemanticVector.sourceHash("Angular", "Signals"),
            SemanticVector.sourceHash("Angular", "RxJS"));
    }
}
