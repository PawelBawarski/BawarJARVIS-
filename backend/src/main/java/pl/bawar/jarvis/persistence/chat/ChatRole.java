package pl.bawar.jarvis.persistence.chat;

import java.util.Locale;

public enum ChatRole {
    USER, ASSISTANT, SYSTEM;

    public String databaseValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static ChatRole fromDatabase(String value) {
        return ChatRole.valueOf(value.toUpperCase(Locale.ROOT));
    }
}
