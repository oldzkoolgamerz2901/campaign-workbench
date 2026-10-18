package workbench.preparation.application

import workbench.preparation.api.*
import workbench.preparation.domain.*
import workbench.sources.api.SelectedSource
import workbench.sources.api.SourceClassification

internal fun SelectedSource.freeze(): CapturedSource {
    fun SourceClassification.freeze() = CapturedClassification(metadata?.let {
        CapturedCard(it.schema, it.id, it.title, it.type, it.purpose, it.status, it.tags.toList(), it.summary)
    }, issues.map { CapturedIssue(it.code, it.field, it.message, it.severity) })
    return CapturedSource(classification.interpretation, bodyStart, classification.freeze(), relationships.map {
        CapturedRelationship(it.key, it.originSection, it.destination,
            CapturedLink(it.target.document, it.target.section, it.target.external, it.target.missing),
            it.classification?.freeze(), it.sceneCandidate)
    })
}

internal fun CapturedSource.data(): CapturedSourceData {
    fun CapturedClassification.data() = CapturedClassificationData(metadata?.let {
        CapturedCardData(it.schema, it.id, it.title, it.type, it.purpose, it.status, it.tags, it.summary)
    }, issues.map { CapturedIssueData(it.code, it.field, it.message, it.severity) })
    return CapturedSourceData(interpretation, bodyStart, classification.data(), relationships.map {
        CapturedRelationshipData(it.key, it.originSection, it.destination,
            CapturedLinkData(it.target.document, it.target.section, it.target.external, it.target.missing),
            it.classification?.data(), it.sceneCandidate)
    })
}

internal fun CapturedSourceData.model(): CapturedSource {
    fun CapturedClassificationData.model() = CapturedClassification(metadata?.let {
        CapturedCard(it.schema, it.id, it.title, it.type, it.purpose, it.status, it.tags, it.summary)
    }, issues.map { CapturedIssue(it.code, it.field, it.message, it.severity) })
    return CapturedSource(interpretation, bodyStart, classification.model(), relationships.map {
        CapturedRelationship(it.key, it.originSection, it.destination,
            CapturedLink(it.target.document, it.target.section, it.target.external, it.target.missing),
            it.classification?.model(), it.sceneCandidate)
    })
}
