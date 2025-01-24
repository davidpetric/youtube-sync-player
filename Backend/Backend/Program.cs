using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json;
using Newtonsoft.Json.Converters;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();


builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddSignalR();

builder.Services.AddCors(options =>
 {
     options.AddPolicy("AllowSpecificOrigin",
         builder =>
         {
             builder
                 .WithOrigins("http://localhost:5173")
                 .AllowAnyMethod()
                 .AllowAnyHeader()
                 .AllowCredentials();
         });
 });


var app = builder.Build();

app.MapDefaultEndpoints();


if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowSpecificOrigin");


app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.MapHub<NotificationHub>("/notificationHub");

app.Run();


[JsonConverter(typeof(StringEnumConverter))]
public enum UserRoles
{
    User,
    Admin
}

[JsonConverter(typeof(StringEnumConverter))]
public enum EventTypes
{
    None,
    ChangeVideoUrl,
    Play,
    Pause,
    Stop,
    Seek,
    Volume,
    Mute,
    Unmute
}

public class UserDto
{
    public Guid UserId { get; set; }

    public string? Name { get; set; }

    public UserRoles Role { get; set; }
}

public class PlayerState
{
    public string OriginalUrl { get; set; }

    public string EmbedUrl { get; set; }

    public EventTypes EventType { get; set; }
}


public static class AppState
{

    public static List<UserDto> ConnectedUsers = new List<UserDto>();
}

public class NotificationHub : Hub
{
    private readonly ILogger<NotificationHub> _logger;


    public NotificationHub(ILogger<NotificationHub> logger)
    {
        _logger = logger;
        logger.LogInformation("Init NotificationHub");
    }


    public async Task ServerSendRegisterNewUser(string clientUserInfo)
    {
        var user = JsonConvert.DeserializeObject<UserDto>(clientUserInfo);

        if (!string.IsNullOrWhiteSpace(clientUserInfo))
        {
            AppState.ConnectedUsers.Add(user);
        }

        _logger.LogInformation("{@Message}", clientUserInfo);

        var listOfUsersConnected = JsonConvert.SerializeObject(AppState.ConnectedUsers);

        await Clients.All.SendAsync("ClientAllOnNewUserConnected", listOfUsersConnected);
    }


    public async Task ServerUpdatePlayerState(string message)
    {
        _logger.LogInformation("{@Message}", message);

        await Clients.All.SendAsync("ClientsAllUpdatePlayerState", message);
    }


    public override Task OnConnectedAsync()
    {
        _logger.LogInformation("Client connected");
        return base.OnConnectedAsync();
    }


    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client disconnected");
        return base.OnDisconnectedAsync(exception);
    }
}

