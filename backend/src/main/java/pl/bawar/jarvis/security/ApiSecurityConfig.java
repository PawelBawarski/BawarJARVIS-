
package pl.bawar.jarvis.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.http.HttpMethod;

import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class ApiSecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http) throws Exception {

        http.authorizeHttpRequests(auth -> auth

                // Pozwalamy tylko odczytać stan API.
                .requestMatchers(
                        HttpMethod.GET,
                        "/api/security/health")
                .permitAll()

                // Wszystkie pozostałe żądania blokujemy.
                .anyRequest().denyAll());

        // Nie udostępniamy formularza logowania
        // ani HTTP Basic jako tymczasowego obejścia.
        http.formLogin(AbstractHttpConfigurer::disable);
        http.httpBasic(AbstractHttpConfigurer::disable);

        // Zachowujemy domyślną ochronę CSRF.
        return http.build();
    }
}
