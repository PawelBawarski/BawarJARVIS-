package pl.bawar.jarvis.agent;

/** User-reviewed source excerpt sent to the LOCAL model. Never grants file access. */
public record AgentCodeSource(String relativePath, String content) { }
