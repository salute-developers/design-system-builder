package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.data.ExposedDraftChangeHandler
import com.dsbuilder.ds.core.data.ResolvedSubjectRows
import com.dsbuilder.ds.core.data.clearResolvedSubjectReads
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Последняя ревизия выбирается до фильтрации, кандидаты не теряют удаление и возврат к исходному. */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class ResolvedSubjectRowsPostgresIntegrationTest {
    @Test
    fun `latest revision filtering and candidate selection preserve historical semantics`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val database = Database.connect(postgres.jdbcUrl, user = postgres.username, password = postgres.password)
            val owner = UUID.randomUUID()
            val baseline = UUID.randomUUID()
            val draft = UUID.randomUUID()
            val token = UUID.randomUUID()
            transaction(database) {
                exec("INSERT INTO design_systems(id,project_name,project_id) VALUES ('$owner','fixture','project')")
                exec(
                    "INSERT INTO design_system_versions(id,design_system_id,status," +
                        "sequence_number,revision,published_at) " +
                        "VALUES ('$baseline','$owner','baseline',0,0,NULL)",
                )
                exec(
                    "INSERT INTO design_system_revisions(design_system_id,design_system_version_id," +
                        "version_sequence_number,name) VALUES ('$owner','$baseline',0,'Fixture')",
                )
                exec("INSERT INTO tokens(id,design_system_id) VALUES ('$token','$owner')")
                exec(
                    "INSERT INTO token_revisions(token_id,design_system_id,design_system_version_id," +
                        "version_sequence_number,name,type) VALUES ('$token','$owner','$baseline',0,'old','color')",
                )
                exec(
                    "INSERT INTO design_system_versions(id,design_system_id,status," +
                        "sequence_number,revision,published_at) VALUES ('$draft','$owner','draft',1,0,NULL)",
                )
                val reader = ResolvedSubjectRows(
                    Tokens,
                    Revisions,
                    Boundaries,
                    Revisions.tokenId,
                    designSystemId = owner,
                )
                assertNull(reader.cached(Revisions.deleted eq false))
                val beforeRead = statementCount
                assertEquals("old", reader.read(Revisions.deleted eq false).single()[Revisions.name])
                assertEquals(beforeRead + 1, statementCount)
                exec(
                    "INSERT INTO token_revisions(token_id,design_system_id,design_system_version_id," +
                        "version_sequence_number,name,type) VALUES ('$token','$owner','$draft',1,'new','gradient')",
                )
                assertEquals("new", reader.read(Revisions.deleted eq false).single()[Revisions.name])
                assertTrue(reader.read((Revisions.deleted eq false) and (Revisions.name eq "old")).isEmpty())
                val journal = handler()
                assertEquals(1, journal.describe(owner, 1, 0, null).size)
                val countBeforeBatch = statementCount
                val selectedIds = (List(200) { UUID.randomUUID() } + token).toSet()
                assertEquals(listOf(token), journal.describeEntities(owner, 1, 0, selectedIds).map { it.entityId })
                assertEquals(countBeforeBatch + 1, statementCount)

                assertTrue(journal.describe(owner, 0, 0, null).isEmpty())
                exec("DELETE FROM token_revisions WHERE design_system_version_id='$draft'")
                exec(
                    "INSERT INTO token_revisions(token_id,design_system_id,design_system_version_id," +
                        "version_sequence_number,name,type,deleted) " +
                        "VALUES ('$token','$owner','$draft',1,'new','gradient',true)",
                )
                assertTrue(reader.read(Revisions.deleted eq false).isEmpty())
                assertEquals(null, journal.describe(owner, 1, 0, null).single().currentValue)
                exec("DELETE FROM token_revisions WHERE design_system_version_id='$draft'")
                exec(
                    "INSERT INTO token_revisions(token_id,design_system_id,design_system_version_id," +
                        "version_sequence_number,name,type) VALUES ('$token','$owner','$draft',1,'old','color')",
                )
                assertFalse(journal.hasChanges(owner, 1, 0))
            }
            transaction(database) {
                connection.readOnly = true
                val reader = ResolvedSubjectRows(Tokens, Revisions, Boundaries, Revisions.tokenId)
                val first = reader.read(Revisions.deleted eq false)
                val statements = statementCount
                assertEquals(first, reader.cached(Revisions.deleted eq false))
                assertNull(reader.cached((Revisions.deleted eq false) and (Revisions.name eq "missing")))
                assertEquals(first, reader.read(Revisions.deleted eq false))
                assertEquals(statements, statementCount)
                clearResolvedSubjectReads()
                assertNull(reader.cached(Revisions.deleted eq false))
                exec("SELECT set_config('ds.design_system_id', '${UUID.randomUUID()}', true)")
                clearResolvedSubjectReads()
                assertTrue(reader.read(Revisions.deleted eq false).isEmpty())
            }
        }
    }

    private fun handler() = ExposedDraftChangeHandler(
        "token", Tokens, Tokens.id, Tokens.owner, Revisions, Revisions.tokenId,
        Revisions.versionId, Revisions.sequence, Revisions.deleted,
        revisionValueColumns = listOf(Revisions.name, Revisions.type),
    )

    private object Tokens : Table("tokens") {
        val id = uuid("id")
        val owner = uuid("design_system_id")
    }

    private object Revisions : Table("token_revisions") {
        val tokenId = uuid("token_id")
        val versionId = uuid("design_system_version_id")
        val sequence = long("version_sequence_number")
        val name = text("name")
        val type = text("type")
        val deleted = bool("deleted")
    }

    private object Boundaries : Table("design_system_versions") {
        val id = uuid("id")
        val sequence = long("sequence_number")
    }
}
