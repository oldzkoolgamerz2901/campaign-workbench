package workbench.preparation.application

import workbench.preparation.api.*
import workbench.preparation.domain.*

internal fun AuthoredOrigin.data() = AuthoredOriginData(draft, card, revision, approval, approvedAt, original, originalHash, originalCampaign, originalCapture, originalPath,
    links.map { FrozenLinkData(it.destination, it.kind, it.path, it.anchor, it.section, it.capture, it.draft, it.revision) })
internal fun AuthoredOriginData.model() = AuthoredOrigin(draft, card, revision, approval, approvedAt, original, originalHash, originalCampaign, originalCapture, originalPath,
    links.map { FrozenLink(it.destination, it.kind, it.path, it.anchor, it.section, it.capture, it.draft, it.revision) })
