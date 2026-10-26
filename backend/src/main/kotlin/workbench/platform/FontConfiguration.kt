package workbench.platform

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import workbench.platform.api.FontMeasurements
import workbench.platform.adapter.font.BundledFontMeasurements

@Configuration
class FontConfiguration {
    @Bean fun fontMeasurements(): FontMeasurements = BundledFontMeasurements()
}
