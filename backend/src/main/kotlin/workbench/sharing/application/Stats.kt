package workbench.sharing.application

import workbench.sharing.api.*
import workbench.sources.api.*

internal fun SharedStats.layoutStats() = LayoutStats(
    subtitle, ac, hp, speed, initiative, cr, skills, vulnerabilities, resistances, immunities, gear, senses, languages,
    abilities.mapValues { (_, a) -> LayoutAbility(a.score, a.modifier, a.save) },
    sections.map { s -> LayoutStatSection(s.title, s.entries.map { e -> LayoutStatEntry(e.name, e.text,
        e.spellcasting?.let { LayoutSpellcasting(it.ability, it.dc, it.spells) }) }) }
)

internal fun workbench.preparation.api.PreparedStats.sharedStats() = SharedStats(
    subtitle, ac, hp, speed, initiative, cr, skills, vulnerabilities, resistances, immunities, gear, senses, languages,
    abilities.mapValues { (_, a) -> SharedAbility(a.score, a.modifier, a.save) },
    sections.map { s -> SharedStatSection(s.title, s.entries.map { e -> SharedStatEntry(e.name, e.text,
        e.spellcasting?.let { SharedSpellcasting(it.ability, it.dc, it.spells) }) }) }
)
