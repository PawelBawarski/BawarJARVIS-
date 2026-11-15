package pl.bawar.jarvis.radio;

import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/radio/favorites")
@PreAuthorize("hasAuthority('ROLE_JARVIS')")
public class RadioFavoritesController {
    private static final Set<String> COUNTRIES = Set.of("PL", "GB", "DE", "FR");
    private final JdbcTemplate jdbc;
    public RadioFavoritesController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Favorite(String id, String name, String countryCode, String streamUrl) { }

    @GetMapping
    public List<Favorite> list() {
        return jdbc.query("""
            SELECT station_id, name, country_code, stream_url
            FROM jarvis_radio_favorites ORDER BY created_at DESC, station_id LIMIT 200
            """, (rs, row) -> new Favorite(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void save(@RequestBody Favorite favorite) {
        validate(favorite);
        jdbc.update("""
            INSERT INTO jarvis_radio_favorites(station_id, name, country_code, stream_url)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (station_id) DO UPDATE SET
                name = EXCLUDED.name, country_code = EXCLUDED.country_code,
                stream_url = EXCLUDED.stream_url
            """, favorite.id(), favorite.name().strip(), favorite.countryCode(), favorite.streamUrl());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        if (id == null || id.isBlank() || id.length() > 80) throw new IllegalArgumentException();
        jdbc.update("DELETE FROM jarvis_radio_favorites WHERE station_id = ?", id);
    }

    static void validate(Favorite favorite) {
        if (favorite == null || favorite.id() == null || favorite.id().isBlank() || favorite.id().length() > 80
            || favorite.name() == null || favorite.name().isBlank() || favorite.name().length() > 100
            || favorite.countryCode() == null || !COUNTRIES.contains(favorite.countryCode())
            || favorite.streamUrl() == null || favorite.streamUrl().length() > 2048
            || !RadioCatalogService.safeStream(favorite.streamUrl())) throw new IllegalArgumentException("RADIO_FAVORITE_INVALID");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public String invalid() { return "RADIO_FAVORITE_INVALID"; }
}
