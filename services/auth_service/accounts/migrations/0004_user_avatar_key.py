from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_user_avatar_data"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_key VARCHAR(255);",
                    reverse_sql="ALTER TABLE users DROP COLUMN IF EXISTS avatar_key;",
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="user",
                    name="avatar_key",
                    field=models.CharField(blank=True, max_length=255, null=True),
                ),
            ],
        ),
    ]
