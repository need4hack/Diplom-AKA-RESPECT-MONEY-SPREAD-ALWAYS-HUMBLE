from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_report_damage_summary"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data TEXT;",
                    reverse_sql="ALTER TABLE users DROP COLUMN IF EXISTS avatar_data;",
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="user",
                    name="avatar_data",
                    field=models.TextField(blank=True, null=True),
                ),
            ],
        ),
    ]
