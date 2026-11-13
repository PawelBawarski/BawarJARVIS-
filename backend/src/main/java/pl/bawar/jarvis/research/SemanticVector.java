package pl.bawar.jarvis.research;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** Pure, defensive utilities for versioned float32 embedding storage. */
final class SemanticVector {
    static final int MIN_DIMS = 32;
    static final int MAX_DIMS = 2048;
    private SemanticVector() { }

    static String sourceHash(String title, String excerpt) {
        try {
            byte[] data = ((title == null ? "" : title) + "\u0000" + (excerpt == null ? "" : excerpt))
                .getBytes(StandardCharsets.UTF_8);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    static float[] normalize(float[] vector) {
        if (vector == null || vector.length < MIN_DIMS || vector.length > MAX_DIMS)
            throw new IllegalArgumentException("SEMANTIC_INVALID_VECTOR");
        double squares = 0;
        for (float v : vector) {
            if (!Float.isFinite(v)) throw new IllegalArgumentException("SEMANTIC_INVALID_VECTOR");
            squares += (double) v * v;
        }
        if (squares < 1e-20 || !Double.isFinite(squares))
            throw new IllegalArgumentException("SEMANTIC_INVALID_VECTOR");
        float[] result = new float[vector.length];
        double norm = Math.sqrt(squares);
        for (int i = 0; i < vector.length; i++) result[i] = (float) (vector[i] / norm);
        return result;
    }

    static byte[] toBytes(float[] normalized) {
        float[] values = normalize(normalized);
        ByteBuffer buffer = ByteBuffer.allocate(values.length * Float.BYTES).order(ByteOrder.BIG_ENDIAN);
        for (float value : values) buffer.putFloat(value);
        return buffer.array();
    }

    static float[] fromBytes(byte[] raw, int dimensions) {
        if (raw == null || dimensions < MIN_DIMS || dimensions > MAX_DIMS || raw.length != dimensions * Float.BYTES)
            throw new IllegalArgumentException("SEMANTIC_INVALID_VECTOR");
        ByteBuffer buffer = ByteBuffer.wrap(raw).order(ByteOrder.BIG_ENDIAN);
        float[] floats = new float[dimensions];
        for (int i = 0; i < dimensions; i++) floats[i] = buffer.getFloat();
        return normalize(floats);
    }

    static double similarity(float[] a, float[] b) {
        if (a == null || b == null || a.length != b.length) return -1;
        double dot = 0;
        for (int i = 0; i < a.length; i++) dot += (double) a[i] * b[i];
        return Math.max(-1, Math.min(1, dot));
    }
}
