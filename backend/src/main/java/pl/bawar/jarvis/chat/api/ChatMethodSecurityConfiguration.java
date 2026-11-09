package pl.bawar.jarvis.chat.api;

import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

/** Activates @PreAuthorize without changing the existing HTTP SecurityFilterChain. */
@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
public class ChatMethodSecurityConfiguration { }
