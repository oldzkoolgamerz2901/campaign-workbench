package workbench.writing.application

import workbench.writing.api.*
import workbench.sources.api.*

internal fun DraftStats.layoutStats() = LayoutStats(
    subtitle, ac, hp, speed, initiative, cr, skills, vulnerabilities, resistances, immunities, gear, senses, languages,
    abilities.mapValues { (_, a) -> LayoutAbility(a.score, a.modifier, a.save) },
    sections.map { s -> LayoutStatSection(s.title, s.entries.map { e -> LayoutStatEntry(e.name, e.text,
        e.spellcasting?.let { LayoutSpellcasting(it.ability, it.dc, it.spells) }) }) }
)
