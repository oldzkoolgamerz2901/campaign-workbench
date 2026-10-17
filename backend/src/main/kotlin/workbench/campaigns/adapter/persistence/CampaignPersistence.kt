package workbench.campaigns.adapter.persistence

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.stereotype.Repository
import workbench.campaigns.api.*
import workbench.campaigns.application.CampaignStore
import java.util.UUID

@Entity
@Table(name = "campaign", schema = "campaigns")
class CampaignEntity(
    @Id var id: UUID = UUID.randomUUID(),
    var name: String = "",
    @Column(unique = true) var directory: String = "",
    @Column(name = "include_patterns") var includes: String = "",
    @Column(name = "exclude_patterns") var excludes: String = "",
    var revision: Long = 0,
) {
    fun model() = Campaign(id, name, directory, includes.lines().filter(String::isNotEmpty), excludes.lines().filter(String::isNotEmpty), revision)
}
@Entity
@Table(name = "selection", schema = "campaigns")
class SelectionEntity(@Id var id: Int = 1, var campaign: UUID? = null)
interface CampaignRepository : JpaRepository<CampaignEntity, UUID> {
    fun existsByDirectory(directory: String): Boolean
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    fun findLockedById(id: UUID): CampaignEntity?
}
interface SelectionRepository : JpaRepository<SelectionEntity, Int>
@Repository
class JpaCampaignStore(private val campaigns: CampaignRepository, private val selections: SelectionRepository) : CampaignStore {
    override fun list() = CampaignList(campaigns.findAll().map { it.model() }.sortedBy { it.name.lowercase() }, selections.findById(1).orElse(null)?.campaign)
    override fun get(id: UUID) = campaigns.findById(id).orElse(null)?.model()
    override fun lock(id: UUID) = campaigns.findLockedById(id)?.model()
    override fun add(campaign: Campaign): Boolean {
        if (campaigns.existsByDirectory(campaign.directory)) return false
        save(campaign); return true
    }
    override fun save(campaign: Campaign) {
        campaigns.saveAndFlush(CampaignEntity(campaign.id, campaign.name, campaign.directory, campaign.includes.joinToString("\n"), campaign.excludes.joinToString("\n"), campaign.revision))
    }
    override fun select(id: UUID) { selections.saveAndFlush(SelectionEntity(campaign = id)) }
}
