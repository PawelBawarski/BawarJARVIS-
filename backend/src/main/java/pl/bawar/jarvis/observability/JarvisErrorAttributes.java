package pl.bawar.jarvis.observability;

import org.springframework.boot.web.error.ErrorAttributeOptions;
import org.springframework.boot.webmvc.error.DefaultErrorAttributes;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.WebRequest;

import java.util.Map;

@Component
public class JarvisErrorAttributes extends DefaultErrorAttributes {

    @Override
    public Map<String, Object> getErrorAttributes(
            WebRequest request,
            ErrorAttributeOptions options
    ) {
        Map<String, Object> attributes =
                super.getErrorAttributes(request, options);

        Object requestId = request.getAttribute(
                RequestIdFilter.MDC_KEY,
                RequestAttributes.SCOPE_REQUEST
        );

        if (requestId instanceof String id && !id.isBlank()) {
            attributes.put("requestId", id);
        }

        Object statusValue = attributes.get("status");

        if (statusValue instanceof Number status
                && status.intValue() >= 500) {

            // Never expose exception messages or stack traces on 5xx.
            attributes.remove("trace");
            attributes.remove("exception");
            attributes.remove("errors");

            attributes.put("code", "INTERNAL_ERROR");
            attributes.put(
                    "message",
                    "Wystąpił wewnętrzny błąd aplikacji."
            );
        }

        return attributes;
    }
}
