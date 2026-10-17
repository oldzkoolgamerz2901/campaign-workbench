package workbench.platform.adapter.persistence

import arrow.core.Either
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionTemplate
import workbench.platform.api.Failure
import workbench.platform.api.Transactions

@Component
class SpringTransactions(private val template: TransactionTemplate) : Transactions {
    override fun <T> run(block: () -> Either<Failure, T>): Either<Failure, T> =
        requireNotNull(template.execute { transaction ->
            block().also { if (it.isLeft()) transaction.setRollbackOnly() }
        })
}
