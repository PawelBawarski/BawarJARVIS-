package pl.bawar.jarvis.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
// JARVIS_15_RESEARCH_MEMORY
public class ApiSecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            @Value("${JARVIS_SESSION_TOKEN:}") String sessionToken
    ) throws Exception {

        http.sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
        );

        http.authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/api/security/health").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/security/private-health")
                    .hasAuthority("ROLE_JARVIS")
                .requestMatchers("/api/chats", "/api/chats/**").hasAuthority("ROLE_JARVIS")
                .requestMatchers("/api/ai-lab", "/api/ai-lab/**").hasAuthority("ROLE_JARVIS")
                .requestMatchers("/api/research", "/api/research/**").hasAuthority("ROLE_JARVIS")
                .requestMatchers("/api/agent", "/api/agent/**").hasAuthority("ROLE_JARVIS") // JARVIS_STAGE16_PLANNER
                .anyRequest().denyAll()
        );

        http.exceptionHandling(errors -> errors.authenticationEntryPoint(
                (_request, response, _exception) ->
                        response.sendError(HttpServletResponse.SC_UNAUTHORIZED)
        ));

        http.csrf(csrf -> csrf.ignoringRequestMatchers(
                        "/api/chats", "/api/chats/**",
                        "/api/ai-lab", "/api/ai-lab/**",
                        "/api/research", "/api/research/**",
                        "/api/agent", "/api/agent/**"
                ));
        http.formLogin(AbstractHttpConfigurer::disable);
        http.httpBasic(AbstractHttpConfigurer::disable);
        // Keep CSRF protection enabled; do not open arbitrary POST endpoints yet.

        http.addFilterBefore(
                new LocalSessionFilter(sessionToken),
                UsernamePasswordAuthenticationFilter.class
        );

        return http.build();
    }
}
