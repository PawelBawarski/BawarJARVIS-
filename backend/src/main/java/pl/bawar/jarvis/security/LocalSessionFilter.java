package pl.bawar.jarvis.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

public final class LocalSessionFilter extends OncePerRequestFilter {

    private final String expectedToken;

    public LocalSessionFilter(String expectedToken) {
        this.expectedToken = expectedToken;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain chain
    ) throws ServletException, IOException {

        String suppliedToken = request.getHeader("X-Jarvis-Session");

        if (isValid(suppliedToken)) {
            var authentication = new UsernamePasswordAuthenticationToken(
                    "jarvis-desktop",
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_JARVIS"))
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        try {
            chain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private boolean isValid(String suppliedToken) {
        // An absent or malformed token is never accepted.
        if (expectedToken == null || !expectedToken.matches("[0-9a-f]{64}")
                || suppliedToken == null || !suppliedToken.matches("[0-9a-f]{64}")) {
            return false;
        }

        return MessageDigest.isEqual(
                expectedToken.getBytes(StandardCharsets.US_ASCII),
                suppliedToken.getBytes(StandardCharsets.US_ASCII)
        );
    }
}
