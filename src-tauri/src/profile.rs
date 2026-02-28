// ⚒️ Tatara IDE — Framework Profile System
//
// Profiles control IDE behavior per framework:
// - LSP configuration
// - Snippets & templates
// - File exclusions
// - Command palette entries
// - Default settings

use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub framework: FrameworkConfig,
    pub lsp: LspConfig,
    pub style: StyleConfig,
    pub paths: PathsConfig,
    pub docker: DockerConfig,
    pub debug: DebugConfig,
    pub database: DatabaseConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkConfig {
    pub name: String,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspConfig {
    pub php: String,
    pub blade: bool,
    pub vue: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StyleConfig {
    pub formatter: String,
    pub on_save: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathsConfig {
    pub exclude: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerConfig {
    pub engine: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugConfig {
    pub php_debugger: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub source: String,
}

impl Default for Profile {
    fn default() -> Self {
        Self::laravel()
    }
}

impl Profile {
    /// Laravel profile — the primary target of Tatara IDE
    pub fn laravel() -> Self {
        Self {
            framework: FrameworkConfig {
                name: "laravel".into(),
                version: None,
            },
            lsp: LspConfig {
                php: "intelephense".into(),
                blade: true,
                vue: true,
            },
            style: StyleConfig {
                formatter: "pint".into(),
                on_save: true,
            },
            paths: PathsConfig {
                exclude: vec![
                    "vendor".into(),
                    "node_modules".into(),
                    "storage/logs".into(),
                    "storage/framework/cache".into(),
                    "bootstrap/cache".into(),
                    ".idea".into(),
                ],
            },
            docker: DockerConfig {
                engine: "sail".into(),
            },
            debug: DebugConfig {
                php_debugger: "xdebug".into(),
            },
            database: DatabaseConfig {
                source: "env".into(),
            },
        }
    }

    /// Plain PHP profile (no framework)
    pub fn plain_php() -> Self {
        Self {
            framework: FrameworkConfig {
                name: "php".into(),
                version: None,
            },
            lsp: LspConfig {
                php: "intelephense".into(),
                blade: false,
                vue: false,
            },
            style: StyleConfig {
                formatter: "php-cs-fixer".into(),
                on_save: true,
            },
            paths: PathsConfig {
                exclude: vec!["vendor".into(), "node_modules".into()],
            },
            docker: DockerConfig {
                engine: "docker-compose".into(),
            },
            debug: DebugConfig {
                php_debugger: "xdebug".into(),
            },
            database: DatabaseConfig {
                source: "env".into(),
            },
        }
    }

    /// Load profile from .tatara/profile.toml
    pub fn load_from_project(project_path: &Path) -> Option<Self> {
        let profile_path = project_path.join(".tatara").join("profile.toml");
        let content = std::fs::read_to_string(&profile_path).ok()?;
        toml::from_str(&content).ok()
    }

    /// Save profile to .tatara/profile.toml
    pub fn save_to_project(&self, project_path: &Path) -> Result<(), String> {
        let tatara_dir = project_path.join(".tatara");
        std::fs::create_dir_all(&tatara_dir).map_err(|e| e.to_string())?;

        let content = toml::to_string_pretty(self).map_err(|e| e.to_string())?;
        let profile_path = tatara_dir.join("profile.toml");
        std::fs::write(profile_path, content).map_err(|e| e.to_string())
    }
}

/// Artisan command definitions for the command palette
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtisanCommand {
    pub name: String,
    pub description: String,
    pub category: String,
    pub template: Option<String>,
}

/// Get available artisan commands for the GUI
pub fn get_artisan_commands() -> Vec<ArtisanCommand> {
    vec![
        // Make commands
        ArtisanCommand {
            name: "make:controller".into(),
            description: "コントローラー作成".into(),
            category: "生成系 (make:)".into(),
            template: Some("php artisan make:controller {name}".into()),
        },
        ArtisanCommand {
            name: "make:model".into(),
            description: "モデル作成".into(),
            category: "生成系 (make:)".into(),
            template: Some("php artisan make:model {name} -m".into()),
        },
        ArtisanCommand {
            name: "make:migration".into(),
            description: "マイグレーション作成".into(),
            category: "生成系 (make:)".into(),
            template: Some("php artisan make:migration {name}".into()),
        },
        ArtisanCommand {
            name: "make:seeder".into(),
            description: "シーダー作成".into(),
            category: "生成系 (make:)".into(),
            template: Some("php artisan make:seeder {name}".into()),
        },
        ArtisanCommand {
            name: "make:request".into(),
            description: "フォームリクエスト作成".into(),
            category: "生成系 (make:)".into(),
            template: Some("php artisan make:request {name}".into()),
        },
        ArtisanCommand {
            name: "make:middleware".into(),
            description: "ミドルウェア作成".into(),
            category: "生成系 (make:)".into(),
            template: Some("php artisan make:middleware {name}".into()),
        },
        ArtisanCommand {
            name: "make:event".into(),
            description: "イベント作成".into(),
            category: "生成系 (make:)".into(),
            template: Some("php artisan make:event {name}".into()),
        },
        ArtisanCommand {
            name: "make:listener".into(),
            description: "リスナー作成".into(),
            category: "生成系 (make:)".into(),
            template: Some("php artisan make:listener {name}".into()),
        },
        ArtisanCommand {
            name: "make:policy".into(),
            description: "ポリシー作成".into(),
            category: "生成系 (make:)".into(),
            template: Some("php artisan make:policy {name}".into()),
        },
        ArtisanCommand {
            name: "make:command".into(),
            description: "コマンド作成".into(),
            category: "生成系 (make:)".into(),
            template: Some("php artisan make:command {name}".into()),
        },
        // DB commands
        ArtisanCommand {
            name: "migrate".into(),
            description: "マイグレーション実行".into(),
            category: "データベース系".into(),
            template: Some("php artisan migrate".into()),
        },
        ArtisanCommand {
            name: "migrate:rollback".into(),
            description: "直前のマイグレーションを戻す".into(),
            category: "データベース系".into(),
            template: Some("php artisan migrate:rollback".into()),
        },
        ArtisanCommand {
            name: "migrate:fresh".into(),
            description: "⚠️ DB全削除→再マイグレーション".into(),
            category: "データベース系".into(),
            template: Some("php artisan migrate:fresh --seed".into()),
        },
        ArtisanCommand {
            name: "migrate:status".into(),
            description: "マイグレーション状態確認".into(),
            category: "データベース系".into(),
            template: Some("php artisan migrate:status".into()),
        },
        ArtisanCommand {
            name: "db:seed".into(),
            description: "シーダー実行".into(),
            category: "データベース系".into(),
            template: Some("php artisan db:seed".into()),
        },
        // Utility commands
        ArtisanCommand {
            name: "route:list".into(),
            description: "ルート一覧表示".into(),
            category: "ユーティリティ".into(),
            template: Some("php artisan route:list".into()),
        },
        ArtisanCommand {
            name: "cache:clear".into(),
            description: "キャッシュクリア".into(),
            category: "ユーティリティ".into(),
            template: Some("php artisan cache:clear".into()),
        },
        ArtisanCommand {
            name: "config:clear".into(),
            description: "設定キャッシュクリア".into(),
            category: "ユーティリティ".into(),
            template: Some("php artisan config:clear".into()),
        },
        ArtisanCommand {
            name: "optimize".into(),
            description: "最適化（本番用）".into(),
            category: "ユーティリティ".into(),
            template: Some("php artisan optimize".into()),
        },
        ArtisanCommand {
            name: "key:generate".into(),
            description: "APP_KEY 生成".into(),
            category: "ユーティリティ".into(),
            template: Some("php artisan key:generate".into()),
        },
        ArtisanCommand {
            name: "tinker".into(),
            description: "対話型 REPL".into(),
            category: "ユーティリティ".into(),
            template: Some("php artisan tinker".into()),
        },
        ArtisanCommand {
            name: "serve".into(),
            description: "開発サーバー起動".into(),
            category: "ユーティリティ".into(),
            template: Some("php artisan serve".into()),
        },
    ]
}

/// Laravel snippet definitions
pub fn get_laravel_snippets() -> Vec<Snippet> {
    vec![
        Snippet {
            prefix: "rc".into(),
            name: "Resource Controller".into(),
            body: r#"<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ${1:Name}Controller extends Controller
{
    public function index()
    {
        //
    }

    public function create()
    {
        //
    }

    public function store(Request $request)
    {
        //
    }

    public function show(${1:Name} $${2:model})
    {
        //
    }

    public function edit(${1:Name} $${2:model})
    {
        //
    }

    public function update(Request $request, ${1:Name} $${2:model})
    {
        //
    }

    public function destroy(${1:Name} $${2:model})
    {
        //
    }
}
"#
            .into(),
        },
        Snippet {
            prefix: "mod".into(),
            name: "Eloquent Model".into(),
            body: r#"<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ${1:Name} extends Model
{
    use HasFactory;

    protected $fillable = [
        ${2:'name'},
    ];

    protected $casts = [
        ${3}
    ];
}
"#
            .into(),
        },
        Snippet {
            prefix: "mig".into(),
            name: "Migration".into(),
            body: r#"<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('${1:table_name}', function (Blueprint $table) {
            $table->id();
            ${2}
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('${1:table_name}');
    }
};
"#
            .into(),
        },
        Snippet {
            prefix: "tf".into(),
            name: "Feature Test".into(),
            body: r#"<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ${1:Name}Test extends TestCase
{
    use RefreshDatabase;

    public function test_${2:example}(): void
    {
        $response = $this->get('/${3:endpoint}');

        $response->assertStatus(200);
    }
}
"#
            .into(),
        },
        Snippet {
            prefix: "rr".into(),
            name: "Resource Route".into(),
            body: "Route::resource('${1:name}', ${2:Name}Controller::class);\n".into(),
        },
        Snippet {
            prefix: "rg".into(),
            name: "GET Route".into(),
            body: "Route::get('/${1:path}', [${2:Name}Controller::class, '${3:method}']);\n".into(),
        },
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub prefix: String,
    pub name: String,
    pub body: String,
}
